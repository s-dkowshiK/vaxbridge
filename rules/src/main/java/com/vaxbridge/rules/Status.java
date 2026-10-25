package com.vaxbridge.rules;

public enum Status {
    /** Series finished. */
    COMPLETE,
    /** At least one dose can be given today. */
    DUE,
    /** Up to date for now; the next dose is in the future. */
    UPCOMING,
    /** Not recommended for this child's age. */
    NOT_NEEDED
}
