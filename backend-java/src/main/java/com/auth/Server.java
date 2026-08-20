package com.auth;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import org.mindrot.jbcrypt.BCrypt;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

public class Server {
    private static final String JWT_SECRET = Db.getEnv("JWT_SECRET", "super_secret_jwt_key_facilitai_2026");
    private static final Gson gson = new Gson();

    public static void main(String[] args) throws Exception {
        Db.initializeDatabase();
        int port = Integer.parseInt(Db.getEnv("PORT_JAVA", "8081"));
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/api/auth/register", new RegisterHandler());
        server.createContext("/api/auth/login", new LoginHandler());
        server.createContext("/api/auth/me", new MeHandler());
        server.createContext("/api/auth/delete", new DeleteHandler());
        server.setExecutor(null); // default executor
        System.out.println("Servidor Java Auth rodando na porta " + port);
        server.start();
    }

    private static void setupCors(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }

    private static void sendResponse(HttpExchange exchange, int statusCode, String response) throws IOException {
        byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static String readBody(HttpExchange exchange) throws IOException {
        InputStream is = exchange.getRequestBody();
        byte[] buffer = new byte[1024 * 8];
        int bytesRead;
        StringBuilder sb = new StringBuilder();
        while ((bytesRead = is.read(buffer)) != -1) {
            sb.append(new String(buffer, 0, bytesRead, StandardCharsets.UTF_8));
        }
        return sb.toString();
    }

    static class RegisterHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            setupCors(exchange);
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, "{\"error\": \"Método não permitido\"}");
                return;
            }

            try {
                String body = readBody(exchange);
                JsonObject json = gson.fromJson(body, JsonObject.class);
                
                String nome = json.has("nome") ? json.get("nome").getAsString().trim() : "";
                String sobrenome = json.has("sobrenome") ? json.get("sobrenome").getAsString().trim() : "";
                String email = json.has("email") ? json.get("email").getAsString().toLowerCase().trim() : "";
                String senha = json.has("senha") ? json.get("senha").getAsString() : (json.has("password") ? json.get("password").getAsString() : "");

                if (nome.isEmpty() || sobrenome.isEmpty() || email.isEmpty() || senha.isEmpty()) {
                    sendResponse(exchange, 400, "{\"error\": \"Nome, sobrenome, e-mail e senha são obrigatórios.\"}");
                    return;
                }

                try (Connection conn = Db.getConnection()) {
                    String sqlCheck = "SELECT id FROM users WHERE email = ?";
                    try (PreparedStatement psCheck = conn.prepareStatement(sqlCheck)) {
                        psCheck.setString(1, email);
                        try (ResultSet rs = psCheck.executeQuery()) {
                            if (rs.next()) {
                                sendResponse(exchange, 400, "{\"error\": \"Este e-mail já está em uso.\"}");
                                return;
                            }
                        }
                    }

                    String passwordHash = BCrypt.hashpw(senha, BCrypt.gensalt(12));
                    String sqlInsert = "INSERT INTO users (nome, sobrenome, email, password_hash) VALUES (?, ?, ?, ?)";
                    try (PreparedStatement psInsert = conn.prepareStatement(sqlInsert, java.sql.Statement.RETURN_GENERATED_KEYS)) {
                        psInsert.setString(1, nome);
                        psInsert.setString(2, sobrenome);
                        psInsert.setString(3, email);
                        psInsert.setString(4, passwordHash);
                        
                        int affectedRows = psInsert.executeUpdate();
                        if (affectedRows > 0) {
                            try (ResultSet rs = psInsert.getGeneratedKeys()) {
                                if (rs.next()) {
                                    int id = rs.getInt(1);

                                    JsonObject payload = new JsonObject();
                                    payload.addProperty("id", id);
                                    payload.addProperty("email", email);
                                    
                                    String token = JWT.sign(payload.toString(), JWT_SECRET);
                                    
                                    JsonObject userObj = new JsonObject();
                                    userObj.addProperty("id", id);
                                    userObj.addProperty("nome", nome);
                                    userObj.addProperty("sobrenome", sobrenome);
                                    userObj.addProperty("email", email);
                                    
                                    JsonObject responseJson = new JsonObject();
                                    responseJson.add("user", userObj);
                                    responseJson.addProperty("token", token);
                                    
                                    sendResponse(exchange, 201, responseJson.toString());
                                } else {
                                    sendResponse(exchange, 500, "{\"error\": \"Erro ao recuperar ID do usuário criado.\"}");
                                }
                            }
                        } else {
                            sendResponse(exchange, 500, "{\"error\": \"Erro ao criar usuário.\"}");
                        }
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
                sendResponse(exchange, 500, "{\"error\": \"Erro interno no servidor.\"}");
            }
        }
    }

    static class LoginHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            setupCors(exchange);
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, "{\"error\": \"Método não permitido\"}");
                return;
            }

            try {
                String body = readBody(exchange);
                JsonObject json = gson.fromJson(body, JsonObject.class);
                
                String email = json.has("email") ? json.get("email").getAsString().toLowerCase().trim() : "";
                String senha = json.has("senha") ? json.get("senha").getAsString() : (json.has("password") ? json.get("password").getAsString() : "");

                if (email.isEmpty() || senha.isEmpty()) {
                    sendResponse(exchange, 400, "{\"error\": \"E-mail e senha são obrigatórios.\"}");
                    return;
                }

                try (Connection conn = Db.getConnection()) {
                    String sql = "SELECT id, nome, sobrenome, email, password_hash FROM users WHERE email = ?";
                    try (PreparedStatement ps = conn.prepareStatement(sql)) {
                        ps.setString(1, email);
                        try (ResultSet rs = ps.executeQuery()) {
                            if (rs.next()) {
                                String hash = rs.getString("password_hash");
                                if (BCrypt.checkpw(senha, hash)) {
                                    int id = rs.getInt("id");
                                    String n = rs.getString("nome");
                                    String s = rs.getString("sobrenome");
                                    String e = rs.getString("email");

                                    // Atualiza last_login
                                    String sqlUpdate = "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?";
                                    try (PreparedStatement psUpdate = conn.prepareStatement(sqlUpdate)) {
                                        psUpdate.setInt(1, id);
                                        psUpdate.executeUpdate();
                                    }

                                    JsonObject payload = new JsonObject();
                                    payload.addProperty("id", id);
                                    payload.addProperty("email", e);
                                    String token = JWT.sign(payload.toString(), JWT_SECRET);

                                    JsonObject userObj = new JsonObject();
                                    userObj.addProperty("id", id);
                                    userObj.addProperty("nome", n);
                                    userObj.addProperty("sobrenome", s);
                                    userObj.addProperty("email", e);

                                    JsonObject responseJson = new JsonObject();
                                    responseJson.add("user", userObj);
                                    responseJson.addProperty("token", token);

                                    sendResponse(exchange, 200, responseJson.toString());
                                } else {
                                    sendResponse(exchange, 401, "{\"error\": \"Credenciais inválidas.\"}");
                                }
                            } else {
                                sendResponse(exchange, 401, "{\"error\": \"Credenciais inválidas.\"}");
                            }
                        }
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
                sendResponse(exchange, 500, "{\"error\": \"Erro interno no servidor.\"}");
            }
        }
    }

    static class MeHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            setupCors(exchange);
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, "{\"error\": \"Método não permitido\"}");
                return;
            }

            String authHeader = exchange.getRequestHeaders().getFirst("Authorization");
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                sendResponse(exchange, 401, "{\"error\": \"Não autenticado.\"}");
                return;
            }

            String token = authHeader.substring(7);
            String payloadJson = JWT.verifyAndGetPayload(token, JWT_SECRET);
            if (payloadJson == null) {
                sendResponse(exchange, 401, "{\"error\": \"Token inválido.\"}");
                return;
            }

            try {
                JsonObject payload = gson.fromJson(payloadJson, JsonObject.class);
                int userId = payload.get("id").getAsInt();

                try (Connection conn = Db.getConnection()) {
                    String sql = "SELECT id, nome, sobrenome, email FROM users WHERE id = ?";
                    try (PreparedStatement ps = conn.prepareStatement(sql)) {
                        ps.setInt(1, userId);
                        try (ResultSet rs = ps.executeQuery()) {
                            if (rs.next()) {
                                JsonObject userObj = new JsonObject();
                                userObj.addProperty("id", rs.getInt("id"));
                                userObj.addProperty("nome", rs.getString("nome"));
                                userObj.addProperty("sobrenome", rs.getString("sobrenome"));
                                userObj.addProperty("email", rs.getString("email"));

                                JsonObject responseJson = new JsonObject();
                                responseJson.add("user", userObj);

                                sendResponse(exchange, 200, responseJson.toString());
                            } else {
                                sendResponse(exchange, 404, "{\"error\": \"Usuário não encontrado.\"}");
                            }
                        }
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
                sendResponse(exchange, 500, "{\"error\": \"Erro interno no servidor.\"}");
            }
        }
    }

    static class DeleteHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            setupCors(exchange);
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if (!"DELETE".equalsIgnoreCase(exchange.getRequestMethod()) && !"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, "{\"error\": \"Método não permitido\"}");
                return;
            }

            String authHeader = exchange.getRequestHeaders().getFirst("Authorization");
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                sendResponse(exchange, 401, "{\"error\": \"Não autenticado.\"}");
                return;
            }

            String token = authHeader.substring(7);
            String payloadJson = JWT.verifyAndGetPayload(token, JWT_SECRET);
            if (payloadJson == null) {
                sendResponse(exchange, 401, "{\"error\": \"Token inválido.\"}");
                return;
            }

            try {
                JsonObject payload = gson.fromJson(payloadJson, JsonObject.class);
                int userId = payload.get("id").getAsInt();

                try (Connection conn = Db.getConnection()) {
                    String sql = "DELETE FROM users WHERE id = ?";
                    try (PreparedStatement ps = conn.prepareStatement(sql)) {
                        ps.setInt(1, userId);
                        int affectedRows = ps.executeUpdate();
                        if (affectedRows > 0) {
                            sendResponse(exchange, 200, "{\"success\": true, \"message\": \"Conta excluída com sucesso.\"}");
                        } else {
                            sendResponse(exchange, 404, "{\"error\": \"Usuário não encontrado.\"}");
                        }
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
                sendResponse(exchange, 500, "{\"error\": \"Erro interno no servidor.\"}");
            }
        }
    }
}
