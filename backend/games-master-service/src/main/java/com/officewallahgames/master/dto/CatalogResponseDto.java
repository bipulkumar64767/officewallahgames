package com.officewallahgames.master.dto;

import com.officewallahgames.master.model.GameMetadata;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CatalogResponseDto {
    private List<ModeSummaryDto> modes;
    private List<GameMetadata> games;
}
