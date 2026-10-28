package com.officewallahgames.master.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ModeSummaryDto {
    private String id;
    private String title;
    private String tagline;
    private String icon;
    private long count;
}
