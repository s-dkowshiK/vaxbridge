package com.vaxbridge.rules;

/**
 * The vaccine components the app understands. The AI record reader splits
 * combination vaccines (pentavalent, hexavalent, MMRV, ...) into these codes.
 */
public enum Antigen {
    HepB("Hepatitis B"),
    RV("Rotavirus"),
    DTaP("DTaP / DTP (diphtheria, tetanus, pertussis)"),
    DT("DT (diphtheria, tetanus)"),
    Tdap("Tdap"),
    Td("Td"),
    Hib("Hib"),
    PCV("Pneumococcal conjugate"),
    IPV("Polio, inactivated (IPV)"),
    OPV("Polio, oral (OPV)"),
    MMR("Measles, mumps, rubella (MMR)"),
    Measles("Measles only"),
    MR("Measles-rubella (MR)"),
    VAR("Varicella (chickenpox)"),
    HepA("Hepatitis A"),
    MenACWY("Meningococcal ACWY"),
    HPV("HPV"),
    BCG("BCG (tuberculosis)"),
    Other("Other / not used in US schedule");

    public final String label;

    Antigen(String label) {
        this.label = label;
    }

    public boolean isLive() {
        return this == MMR || this == Measles || this == MR || this == VAR;
    }
}
