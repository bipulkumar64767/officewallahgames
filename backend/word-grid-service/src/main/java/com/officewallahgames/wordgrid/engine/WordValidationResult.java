package com.officewallahgames.wordgrid.engine;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WordValidationResult {
    private boolean valid;
    private String word;
    private String errorMessage;
    private int scoreDelta;
}
