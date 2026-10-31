package com.officewallahgames.server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.officewallahgames")
public class OfficeWallahGamesApplication {
    public static void main(String[] args) {
        SpringApplication.run(OfficeWallahGamesApplication.class, args);
    }
}
