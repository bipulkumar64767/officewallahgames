package com.officewallahgames.server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;

@SpringBootApplication
@ComponentScan(
    basePackages = "com.officewallahgames",
    excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = {
            com.officewallahgames.master.GamesMasterApplication.class,
            com.officewallahgames.user.UserManagementApplication.class,
            com.officewallahgames.tictactoe.TicTacToeApplication.class,
            com.officewallahgames.ludo.LudoApplication.class,
            com.officewallahgames.wordgrid.WordGridApplication.class,
            com.officewallahgames.connectdrop.ConnectDropApplication.class
        }
    )
)
public class OfficeWallahGamesApplication {
    public static void main(String[] args) {
        SpringApplication.run(OfficeWallahGamesApplication.class, args);
    }
}
