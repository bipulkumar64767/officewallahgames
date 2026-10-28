package com.officewallahgames.connectdrop;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = {"com.officewallahgames.connectdrop", "com.officewallahgames.common"})
public class ConnectDropApplication {

    public static void main(String[] args) {
        SpringApplication.run(ConnectDropApplication.class, args);
    }
}
