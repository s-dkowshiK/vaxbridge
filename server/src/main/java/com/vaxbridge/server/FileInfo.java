package com.vaxbridge.server;

/** Details of a saved photo or PDF, without its bytes. */
public record FileInfo(Long id, String name, String contentType, long size) {
}
