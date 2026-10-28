package com.officewallahgames.common.exception;

/**
 * Custom runtime exception for game-related errors.
 */
public class GameException extends RuntimeException {

    public GameException(String message) {
        super(message);
    }

    public GameException(String message, Throwable cause) {
        super(message, cause);
    }
}
