package dev.tjj.easi.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;

/** Serves the React SPA for all non-API routes, enabling client-side routing. */
@Controller
public class HomeController {

    /** Forwards any unmatched path (no dot = not a static asset or swagger route) to the React index.html. */
    @GetMapping(value = { "/", "/{path:(?!assets$|swagger-ui$|v3$)[^\\.]*}", "/{path:(?!assets$|swagger-ui$|v3$)[^\\.]*}/**" })
    public String spa() {
        return "forward:/index.html";
    }

    /** Simple health-check endpoint. */
    @GetMapping("/test")
    @ResponseBody
    public String test() {
        return "Tung Tung Tung Sahur!";
    }
}
