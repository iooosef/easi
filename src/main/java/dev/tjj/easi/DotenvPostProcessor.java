package dev.tjj.easi;

import io.github.cdimascio.dotenv.Dotenv;
import io.github.cdimascio.dotenv.DotenvException;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.util.HashMap;
import java.util.Map;

/** Loads variables from a .env file into the Spring environment at startup. */
public class DotenvPostProcessor implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        try {
            Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
            Map<String, Object> props = new HashMap<>();
            dotenv.entries().forEach(e -> props.put(e.getKey(), e.getValue()));
            // lowest priority — system env vars and -D flags still override
            environment.getPropertySources().addLast(new MapPropertySource("dotenv", props));
        } catch (DotenvException ignored) {
            // .env missing or malformed — fall back to system environment variables
        }
    }
}
