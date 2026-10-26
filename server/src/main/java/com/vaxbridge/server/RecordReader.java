package com.vaxbridge.server;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.core.JsonValue;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.errors.UnauthorizedException;
import com.anthropic.models.messages.Base64ImageSource;
import com.anthropic.models.messages.Base64PdfSource;
import com.anthropic.models.messages.ContentBlockParam;
import com.anthropic.models.messages.DocumentBlockParam;
import com.anthropic.models.messages.ImageBlockParam;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.OutputConfig;
import com.anthropic.models.messages.StopReason;
import com.anthropic.models.messages.StructuredMessage;
import com.anthropic.models.messages.StructuredMessageCreateParams;
import com.anthropic.models.messages.StructuredOutputConfig;
import com.anthropic.models.messages.TextBlockParam;
import com.anthropic.models.messages.ThinkingConfigAdaptive;
import com.vaxbridge.rules.Antigen;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Reads a photo or scan of a vaccine record with Claude and returns structured doses.
 *
 * <p>Claude only reads, translates, and normalizes the record. It does not decide
 * what the child needs; that is done by the rules engine in the rules module.
 */
@Service
public class RecordReader {
    static final String MODEL = "claude-opus-5-5";
    static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/gif", "image/webp");

    static final String PROMPT = """
            You are reading a child's vaccination record from another country so a US school nurse
            can review it. The record may be handwritten, stamped, photographed at an angle, and in any
            language or script.

            Transcribe every vaccination entry you can see. For each one:
            - Copy the vaccine name exactly as written (originalText) and give an English translation.
            - Split combination vaccines into their parts using only these antigen codes:
              %s.
              Examples: pentavalent (DTwP-HepB-Hib) -> DTaP, HepB, Hib. Hexavalent -> DTaP, IPV, Hib, HepB.
              MMRV -> MMR, VAR. DTP / DTwP / DTaP -> DTaP. bOPV / tOPV / OPV -> OPV. Measles-only -> Measles.
              Use Other for anything not in the list, and say what it is in notes.
            - Convert the date to YYYY-MM-DD. Many countries write the day before the month; use the
              record's own conventions and the order of the doses to decide. Copy the date exactly as
              written in dateAsWritten. If you cannot read the date, leave date empty.
            - Set confidence to "low" for anything you had to guess (smudged digits, ambiguous day/month,
              unclear vaccine name) and explain the guess in notes. Otherwise "high".

            Also extract the child's name, date of birth, and the country and language of the record if
            visible. Never invent entries that are not on the record. If the image is not a vaccine
            record, return no entries and say so in warnings.
            """.formatted(Arrays.stream(Antigen.values()).map(Enum::name).collect(Collectors.joining(", ")));

    public static class ReadException extends RuntimeException {
        public ReadException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    public record Upload(byte[] data, String mediaType) {
    }

    private static final Logger log = LoggerFactory.getLogger(RecordReader.class);

    private AnthropicClient client;

    private synchronized AnthropicClient client() {
        if (client == null) {
            client = AnthropicOkHttpClient.fromEnv();  // reads ANTHROPIC_API_KEY
        }
        return client;
    }

    /** Several uploads can be pages of the same record. */
    public ExtractedRecord read(List<Upload> uploads) {
        StructuredMessageCreateParams<ExtractedRecord> params = buildRequest(uploads);

        String key = System.getenv("ANTHROPIC_API_KEY");
        if (key == null || key.isBlank()) {
            throw new ReadException("ANTHROPIC_API_KEY is not set on the server.", null);
        }

        StructuredMessage<ExtractedRecord> response;
        try {
            response = client().messages().create(params);
        } catch (UnauthorizedException e) {
            // Logs Anthropic's reason (never the key) so it shows in the host's logs.
            log.warn("Anthropic rejected the API key: {}", e.getMessage());
            throw new ReadException("Anthropic rejected the API key in ANTHROPIC_API_KEY. Check the key and try again.", e);
        } catch (RateLimitException e) {
            throw new ReadException("Too many requests right now. Wait a minute and try again.", e);
        } catch (AnthropicServiceException e) {
            log.warn("Anthropic API error {}: {}", e.statusCode(), e.getMessage());
            throw new ReadException("The AI service returned an error (" + e.statusCode() + ").", e);
        } catch (RuntimeException e) {
            throw new ReadException("Could not reach the AI service: " + e.getMessage(), e);
        }

        StopReason stop = response.stopReason().orElse(null);
        if (StopReason.REFUSAL.equals(stop)) {
            throw new ReadException("The AI declined to read this file.", null);
        }
        if (StopReason.MAX_TOKENS.equals(stop)) {
            throw new ReadException("The record was too long to read in one pass. Try fewer pages.", null);
        }
        return response.content().stream()
                .flatMap(block -> block.text().stream())
                .map(text -> text.text())
                .findFirst()
                .orElseThrow(() -> new ReadException("The AI did not return a result.", null));
    }

    static StructuredMessageCreateParams<ExtractedRecord> buildRequest(List<Upload> uploads) {
        List<ContentBlockParam> content = new ArrayList<>();
        for (Upload upload : uploads) {
            content.add(block(upload));
        }
        content.add(ContentBlockParam.ofText(TextBlockParam.builder().text(PROMPT).build()));

        return MessageCreateParams.builder()
                .model(MODEL)
                .maxTokens(32000L)
                .thinking(ThinkingConfigAdaptive.builder().build())
                .addUserMessageOfContentBlockParams(content)
                // If the model declines, the API retries on Anthropic's recommended fallback model.
                .putAdditionalHeader("anthropic-beta", "server-side-fallback-2026-07-01")
                .putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
                // The response must match the ExtractedRecord shape.
                .outputConfig(StructuredOutputConfig.<ExtractedRecord>builder()
                        .format(ExtractedRecord.class)
                        .effort(OutputConfig.Effort.HIGH)
                        .build())
                .build();
    }

    private static ContentBlockParam block(Upload upload) {
        String data = Base64.getEncoder().encodeToString(upload.data());
        if ("application/pdf".equals(upload.mediaType())) {
            return ContentBlockParam.ofDocument(DocumentBlockParam.builder()
                    .source(Base64PdfSource.builder().data(data).build())
                    .build());
        }
        if (IMAGE_TYPES.contains(upload.mediaType())) {
            return ContentBlockParam.ofImage(ImageBlockParam.builder()
                    .source(Base64ImageSource.builder()
                            .mediaType(Base64ImageSource.MediaType.of(upload.mediaType()))
                            .data(data)
                            .build())
                    .build());
        }
        throw new ReadException("Unsupported file type: " + upload.mediaType()
                + ". Upload a JPG, PNG, WEBP, GIF, or PDF.", null);
    }
}
