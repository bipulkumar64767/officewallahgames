package com.officewallahgames.master.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GameToggleRequest {
    private Boolean isActive;
    private Boolean isMaintenance;
    private String reason;
}
