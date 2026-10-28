package com.officewallahgames.wordgrid;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@ComponentScan(basePackages = {"com.officewallahgames.wordgrid", "com.officewallahgames.common"})
public class WordGridApplication {

    public static void main(String[] args) {
        SpringApplication.run(WordGridApplication.class, args);
    }
}
