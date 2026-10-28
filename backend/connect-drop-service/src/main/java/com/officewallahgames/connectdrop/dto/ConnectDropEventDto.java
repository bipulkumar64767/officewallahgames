package com.officewallahgames.connectdrop.dto;

import com.officewallahgames.connectdrop.model.ConnectDropSession;
import com.officewallahgames.connectdrop.model.DropResult;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConnectDropEventDto {
    private String eventType;
    private ConnectDropSession session;
    private DropResult lastDrop;
    private String message;
}
