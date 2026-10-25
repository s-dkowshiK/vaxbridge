package com.vaxbridge.server;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class VaxBridgeApplication {
    public static void main(String[] args) {
        // System properties take priority over application.properties, so this replaces the local database.
        databaseProperties(System.getenv("DATABASE_URL")).forEach(System::setProperty);
        SpringApplication.run(VaxBridgeApplication.class, args);
    }

    /**
     * Online, the app uses a PostgreSQL database given as DATABASE_URL, in the form hosts like Neon
     * and Render show it: postgresql://user:password@host/dbname?sslmode=require.
     * Without it, the app uses a local database file in ./data (see application.properties).
     */
    static Map<String, String> databaseProperties(String databaseUrl) {
        Map<String, String> props = new HashMap<>();
        if (databaseUrl == null || databaseUrl.isBlank()) {
            return props;
        }
        if (databaseUrl.startsWith("jdbc:")) {
            props.put("spring.datasource.url", databaseUrl);
            return props;
        }
        URI uri = URI.create(databaseUrl.trim());
        String query = uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery();
        String port = uri.getPort() == -1 ? "" : ":" + uri.getPort();
        props.put("spring.datasource.url", "jdbc:postgresql://" + uri.getHost() + port + uri.getRawPath() + query);
        String userInfo = uri.getRawUserInfo();
        if (userInfo != null) {
            String[] parts = userInfo.split(":", 2);
            props.put("spring.datasource.username", URLDecoder.decode(parts[0], StandardCharsets.UTF_8));
            if (parts.length > 1) {
                props.put("spring.datasource.password", URLDecoder.decode(parts[1], StandardCharsets.UTF_8));
            }
        }
        return props;
    }
}
