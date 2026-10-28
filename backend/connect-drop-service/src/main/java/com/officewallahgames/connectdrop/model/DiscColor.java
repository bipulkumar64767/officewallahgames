package com.officewallahgames.connectdrop.model;

public enum DiscColor {
    RED(1),
    YELLOW(2);

    private final int value;

    DiscColor(int value) {
        this.value = value;
    }

    public int getValue() {
        return value;
    }

    public static DiscColor fromValue(int value) {
        if (value == 1) return RED;
        if (value == 2) return YELLOW;
        throw new IllegalArgumentException("Unknown disc color value: " + value);
    }

    public DiscColor other() {
        return this == RED ? YELLOW : RED;
    }
}
