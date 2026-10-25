package com.vaxbridge.server;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

class VaxBridgeApplicationTest {
    @Test
    void readsPostgresUrlsTheWayHostsShowThem() {
        Map<String, String> p = VaxBridgeApplication.databaseProperties(
                "postgresql://vax_user:p%40ss@ep-cool-1.us-east-2.aws.neon.tech/vaxbridge?sslmode=require");
        assertThat(p).containsEntry("spring.datasource.url",
                        "jdbc:postgresql://ep-cool-1.us-east-2.aws.neon.tech/vaxbridge?sslmode=require")
                .containsEntry("spring.datasource.username", "vax_user")
                .containsEntry("spring.datasource.password", "p@ss");
    }

    @Test
    void keepsPortAndAcceptsJdbcUrls() {
        assertThat(VaxBridgeApplication.databaseProperties("postgres://u:p@db.internal:5432/vb"))
                .containsEntry("spring.datasource.url", "jdbc:postgresql://db.internal:5432/vb");
        assertThat(VaxBridgeApplication.databaseProperties("jdbc:h2:mem:x"))
                .containsEntry("spring.datasource.url", "jdbc:h2:mem:x");
        assertThat(VaxBridgeApplication.databaseProperties(null)).isEmpty();
    }
}
