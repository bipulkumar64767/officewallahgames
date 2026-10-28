package com.officewallahgames.ludo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.officewallahgames")
public class LudoApplication {

    public static void main(String[] args) {
        SpringApplication.run(LudoApplication.class, args);
    }
}
