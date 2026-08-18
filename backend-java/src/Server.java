import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class Server {
    private static final String JWT_SECRET = Db.getEnv("JWT_SECRET", "default_jwt_secret_123456789_long_enough");

    public static void main(String[] args) throws Exception {
        Db.initializeDatabase();
        int port = Integer.parseInt(Db.getEnv("PORT_JAVA", "8081"));
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/api/auth/register", new RegisterHandler());
        server.createContext("/api/auth/login", new LoginHandler());
        server.createContext("/api/auth/me", new MeHandler());
        server.setExecutor(null); // default executor
        System.out.println("Servidor Java Auth rodando na porta " + port);
        server.start();
    }

    private static void setupCors(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }

    private static String getJsonField(String json, String field) {
        Pattern pattern = Pattern.compile("\"" + field + "\"[\\s]*:[\\s]*\"([^\"]*)\"");
        Matcher matcher = pattern.matcher(json);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return "";
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
                String nome = getJsonField(body, "nome").trim();
                String sobrenome = getJsonField(body, "sobrenome").trim();
                String email = getJsonField(body, "email").toLowerCase().trim();
                String senha = getJsonField(body, "senha");
                if (senha.isEmpty()) {
                    senha = getJsonField(body, "password");
                }

                if (nome.isEmpty() || sobrenome.isEmpty() || email.isEmpty() || senha.isEmpty()) {
                    sendResponse(exchange, 400, "{\"error\": \"Nome, sobrenome, e-mail e senha são obrigatórios.\"}");
                    return;
                }

                try (Connection conn = Db.getConnection()) {
                    // Verifica se o usuário já existe
                    String sqlCheck = "SELECT id FROM users WHERE email = ?";
                    try (PreparedStatement psCheck = conn.prepareStatement(sqlCheck)) {
                        psCheck.setString(1, email);
                        try (ResultSet rs = psCheck.executeQuery()) {
                            if (rs.next()) {
                                sendResponse(exchange, 409, "{\"error\": \"Este e-mail já está cadastrado.\"}");
                                return;
                            }
                        }
                    }

                    // Hash da senha
                    String passwordHash = BCrypt.hashpw(senha, BCrypt.gensalt());

                    // Insere o novo usuário
                    String sqlInsert = "INSERT INTO users (nome, sobrenome, email, password_hash, created_at, last_login) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id, nome, sobrenome, email";
                    try (PreparedStatement psInsert = conn.prepareStatement(sqlInsert)) {
                        psInsert.setString(1, nome);
                        psInsert.setString(2, sobrenome);
                        psInsert.setString(3, email);
                        psInsert.setString(4, passwordHash);

                        try (ResultSet rs = psInsert.executeQuery()) {
                            if (rs.next()) {
                                int id = rs.getInt("id");
                                String userNome = rs.getString("nome");
                                String userSobrenome = rs.getString("sobrenome");
                                String userEmail = rs.getString("email");

                                String userJson = String.format("{\"id\":%d,\"nome\":\"%s\",\"sobrenome\":\"%s\",\"email\":\"%s\"}", id, userNome, userSobrenome, userEmail);
                                String token = JWT.sign(userJson, JWT_SECRET);

                                sendResponse(exchange, 200, String.format("{\"success\":true,\"token\":\"%s\",\"user\":%s}", token, userJson));
                            } else {
                                throw new Exception("Falha ao recuperar usuário inserido");
                            }
                        }
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
                sendResponse(exchange, 500, "{\"error\": \"Erro ao criar a conta: " + e.getMessage() + "\"}");
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
                String email = getJsonField(body, "email").toLowerCase().trim();
                String senha = getJsonField(body, "senha");
                if (senha.isEmpty()) {
                    senha = getJsonField(body, "password");
                }

                if (email.isEmpty() || senha.isEmpty()) {
                    sendResponse(exchange, 400, "{\"error\": \"E-mail e senha são obrigatórios.\"}");
                    return;
                }

                try (Connection conn = Db.getConnection()) {
                    String sql = "SELECT * FROM users WHERE email = ?";
                    try (PreparedStatement ps = conn.prepareStatement(sql)) {
                        ps.setString(1, email);
                        try (ResultSet rs = ps.executeQuery()) {
                            if (!rs.next()) {
                                sendResponse(exchange, 401, "{\"error\": \"Usuário não encontrado.\"}");
                                return;
                            }

                            String dbHash = rs.getString("password_hash");
                            if (!BCrypt.checkpw(senha, dbHash)) {
                                sendResponse(exchange, 401, "{\"error\": \"Senha incorreta.\"}");
                                return;
                            }

                            int id = rs.getInt("id");
                            String nome = rs.getString("nome");
                            String sobrenome = rs.getString("sobrenome");
                            String userEmail = rs.getString("email");

                            // Atualiza last_login
                            String sqlUpdate = "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?";
                            try (PreparedStatement psUpdate = conn.prepareStatement(sqlUpdate)) {
                                psUpdate.setInt(1, id);
                                psUpdate.executeUpdate();
                            }

                            String userJson = String.format("{\"id\":%d,\"nome\":\"%s\",\"sobrenome\":\"%s\",\"email\":\"%s\"}", id, nome, sobrenome, userEmail);
                            String token = JWT.sign(userJson, JWT_SECRET);

                            sendResponse(exchange, 200, String.format("{\"success\":true,\"token\":\"%s\",\"user\":%s}", token, userJson));
                        }
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
                sendResponse(exchange, 500, "{\"error\": \"Erro ao fazer login: " + e.getMessage() + "\"}");
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

            try {
                String authHeader = exchange.getRequestHeaders().getFirst("Authorization");
                if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                    sendResponse(exchange, 401, "{\"error\": \"Não autenticado.\"}");
                    return;
                }

                String token = authHeader.substring(7);
                String userJson = JWT.verifyAndGetPayload(token, JWT_SECRET);
                if (userJson == null) {
                    sendResponse(exchange, 401, "{\"error\": \"Token inválido.\"}");
                    return;
                }

                sendResponse(exchange, 200, String.format("{\"user\": %s}", userJson));
            } catch (Exception e) {
                e.printStackTrace();
                sendResponse(exchange, 500, "{\"error\": \"Erro na verificação de token: " + e.getMessage() + "\"}");
            }
        }
    }
}
