package com.officewallahgames.ludo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LudoEventDto {

    private String eventType;
    private Object data;
    private String message;

    @Builder.Default
    private long timestamp = System.currentTimeMillis();

    public static LudoEventDto of(String eventType, Object data, String message) {
        return LudoEventDto.builder()
                .eventType(eventType)
                .data(data)
                .message(message)
                .timestamp(System.currentTimeMillis())
                .build();
    }
}
