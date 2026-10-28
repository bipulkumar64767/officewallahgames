package com.officewallahgames.common.dto;

/**
 * Generic API response wrapper.
 *
 * @param <T> the type of the response data
 */
public record ApiResponse<T>(String status, T data, String message) {

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>("success", data, null);
    }

    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>("error", null, message);
    }
}
