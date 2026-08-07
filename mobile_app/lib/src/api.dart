import "dart:convert";
import "dart:io";

import "package:http/http.dart" as http;

class ApiException implements Exception {
  ApiException(this.status, this.message, {this.hint});

  final int status;
  final String message;
  final String? hint;

  bool get isAuth => status == 401;

  @override
  String toString() => hint == null ? message : "$message — $hint";
}

/// Thin client over the site's /api/admin surface. Every call carries the
/// bearer token issued at login; a 401 is surfaced as [ApiException.isAuth]
/// so the app can bounce back to the login screen.
class Api {
  Api({required this.baseUrl, this.token});

  String baseUrl;
  String? token;

  Uri _uri(String path, [Map<String, String>? query]) {
    final String normalised = baseUrl.endsWith("/")
        ? baseUrl.substring(0, baseUrl.length - 1)
        : baseUrl;
    return Uri.parse("$normalised$path").replace(queryParameters: query);
  }

  Map<String, String> _headers({bool json = true}) {
    return <String, String>{
      if (json) "content-type": "application/json",
      "accept": "application/json",
      if (token != null) "authorization": "Bearer $token",
    };
  }

  Never _fail(http.Response res) {
    String message = "request failed (${res.statusCode})";
    String? hint;
    try {
      final dynamic body = jsonDecode(res.body);
      if (body is Map<String, dynamic>) {
        message = (body["error"] ?? message).toString();
        hint = body["hint"]?.toString();
      }
    } catch (_) {
      // Non-JSON error body — keep the generic message.
    }
    throw ApiException(res.statusCode, message, hint: hint);
  }

  dynamic _decode(http.Response res) {
    if (res.statusCode < 200 || res.statusCode >= 300) _fail(res);
    if (res.body.isEmpty) return null;
    return jsonDecode(res.body);
  }

  Future<dynamic> _get(String path, [Map<String, String>? query]) async {
    final http.Response res = await http
        .get(_uri(path, query), headers: _headers(json: false))
        .timeout(const Duration(seconds: 30));
    return _decode(res);
  }

  Future<dynamic> _send(
    String method,
    String path, {
    Object? body,
    Map<String, String>? query,
  }) async {
    final http.Request request = http.Request(method, _uri(path, query))
      ..headers.addAll(_headers());
    if (body != null) request.body = jsonEncode(body);

    final http.StreamedResponse streamed =
        await request.send().timeout(const Duration(seconds: 60));
    return _decode(await http.Response.fromStream(streamed));
  }

  /* ---------------- auth ---------------- */

  Future<Map<String, dynamic>> login(String email, String password) async {
    // Login is the one call that must not send a stale token.
    final http.Response res = await http
        .post(
          _uri("/api/admin/login"),
          headers: const <String, String>{"content-type": "application/json"},
          body: jsonEncode(<String, String>{
            "email": email,
            "password": password,
            "client": "mobile",
          }),
        )
        .timeout(const Duration(seconds: 30));
    return Map<String, dynamic>.from(_decode(res) as Map<dynamic, dynamic>);
  }

  Future<Map<String, dynamic>> me() async =>
      Map<String, dynamic>.from(await _get("/api/admin/me") as Map<dynamic, dynamic>);

  Future<Map<String, dynamic>> account() async =>
      Map<String, dynamic>.from(await _get("/api/admin/account") as Map<dynamic, dynamic>);

  Future<Map<String, dynamic>> updateAccount(Map<String, dynamic> patch) async =>
      Map<String, dynamic>.from(
          await _send("PUT", "/api/admin/account", body: patch) as Map<dynamic, dynamic>);

  /* ---------------- schema + records ---------------- */

  Future<List<dynamic>> schema() async {
    final Map<dynamic, dynamic> body =
        await _get("/api/admin/schema") as Map<dynamic, dynamic>;
    return List<dynamic>.from(body["collections"] as List<dynamic>);
  }

  Future<Map<String, dynamic>> records(String collection) async =>
      Map<String, dynamic>.from(await _get(
        "/api/admin/records",
        <String, String>{"collection": collection},
      ) as Map<dynamic, dynamic>);

  Future<void> saveRecord(
    String collection,
    Map<String, dynamic> record, {
    String? previousId,
  }) async {
    await _send(
      "PUT",
      "/api/admin/records",
      query: <String, String>{"collection": collection},
      body: <String, dynamic>{
        "record": record,
        if (previousId != null) "previousId": previousId,
      },
    );
  }

  Future<void> deleteRecord(String collection, String id) async {
    await _send(
      "DELETE",
      "/api/admin/records",
      query: <String, String>{"collection": collection, "id": id},
    );
  }

  Future<void> reorder(String collection, String id, int direction) async {
    await _send(
      "PATCH",
      "/api/admin/records",
      query: <String, String>{"collection": collection},
      body: <String, dynamic>{"id": id, "direction": direction},
    );
  }

  Future<Map<String, dynamic>> migrate({bool overwrite = false}) async =>
      Map<String, dynamic>.from(await _send(
        "POST",
        "/api/admin/migrate",
        body: <String, dynamic>{"overwrite": overwrite},
      ) as Map<dynamic, dynamic>);

  /* ---------------- routine ---------------- */

  Future<Map<String, dynamic>> routine() async =>
      Map<String, dynamic>.from(await _get("/api/admin/routine") as Map<dynamic, dynamic>);

  Future<void> saveRoutine(Map<String, dynamic> routine) async {
    await _send("PUT", "/api/admin/routine", body: routine);
  }

  Future<Map<String, dynamic>> checkins() async =>
      Map<String, dynamic>.from(await _get("/api/admin/checkin") as Map<dynamic, dynamic>);

  Future<void> checkin(String date, String blockId, String status) async {
    await _send(
      "POST",
      "/api/admin/checkin",
      body: <String, dynamic>{"date": date, "blockId": blockId, "status": status},
    );
  }

  Future<void> clearCheckin(String date, String blockId) async {
    await _send(
      "DELETE",
      "/api/admin/checkin",
      query: <String, String>{"date": date, "blockId": blockId},
    );
  }

  /* ---------------- résumé ---------------- */

  Future<List<dynamic>> uploads() async {
    final Map<dynamic, dynamic> body =
        await _get("/api/admin/upload") as Map<dynamic, dynamic>;
    return List<dynamic>.from(body["uploads"] as List<dynamic>);
  }

  Future<Map<String, dynamic>> uploadResume({
    required String filename,
    List<int>? bytes,
    String? path,
  }) async {
    final http.MultipartRequest request =
        http.MultipartRequest("POST", _uri("/api/admin/upload"));
    if (token != null) request.headers["authorization"] = "Bearer $token";

    if (bytes != null) {
      request.files.add(http.MultipartFile.fromBytes("file", bytes, filename: filename));
    } else if (path != null) {
      request.files.add(await http.MultipartFile.fromPath("file", path, filename: filename));
    } else {
      throw ApiException(400, "no file contents to upload");
    }

    final http.StreamedResponse streamed =
        await request.send().timeout(const Duration(seconds: 90));
    final http.Response res = await http.Response.fromStream(streamed);
    return Map<String, dynamic>.from(_decode(res) as Map<dynamic, dynamic>);
  }

  Future<Map<String, dynamic>> extract(String id) async =>
      Map<String, dynamic>.from(await _send(
        "POST",
        "/api/admin/extract",
        body: <String, dynamic>{"id": id},
      ) as Map<dynamic, dynamic>);

  Future<Map<String, dynamic>> applyExtraction({
    required Map<String, dynamic> extraction,
    required Map<String, dynamic> delta,
    required List<String> sections,
  }) async =>
      Map<String, dynamic>.from(await _send(
        "POST",
        "/api/admin/apply",
        body: <String, dynamic>{
          "extraction": extraction,
          "delta": delta,
          "sections": sections,
        },
      ) as Map<dynamic, dynamic>);

  /* ---------------- public read-only ---------------- */

  Future<Map<String, dynamic>> health() async {
    final http.Response res = await http
        .get(_uri("/api/health"))
        .timeout(const Duration(seconds: 15));
    return Map<String, dynamic>.from(_decode(res) as Map<dynamic, dynamic>);
  }

  Future<Map<String, dynamic>> dayStatus() async {
    final http.Response res = await http
        .get(_uri("/api/routine"))
        .timeout(const Duration(seconds: 15));
    return Map<String, dynamic>.from(_decode(res) as Map<dynamic, dynamic>);
  }

  /// Quick reachability probe used by the login screen so a wrong base URL
  /// reports "cannot reach the server" rather than "incorrect password".
  Future<bool> reachable() async {
    try {
      await health();
      return true;
    } on SocketException {
      return false;
    } catch (_) {
      return false;
    }
  }
}
