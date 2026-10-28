package com.officewallahgames.master;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.officewallahgames")
public class GamesMasterApplication {

    public static void main(String[] args) {
        SpringApplication.run(GamesMasterApplication.class, args);
    }
}
