import "package:flutter/material.dart";
import "package:flutter_secure_storage/flutter_secure_storage.dart";

import "api.dart";

/// Auth + connection state for the whole app. Kept deliberately small:
/// a base URL, a bearer token, and the admin record behind it.
class Session extends ChangeNotifier {
  Session();

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );
  static const _keyToken = "admin_token";
  static const _keyBase = "base_url";
  static const _keyEmail = "last_email";

  static const String defaultBaseUrl = String.fromEnvironment(
    "BASE_URL",
    defaultValue: "http://10.0.2.2:8008",
  );

  Api api = Api(baseUrl: defaultBaseUrl);
  Map<String, dynamic>? admin;
  Map<String, dynamic>? capabilities;
  String? backend;
  String lastEmail = "";
  bool restoring = true;
  String? restoreError;

  bool get signedIn => admin != null;
  String get baseUrl => api.baseUrl;

  /// Called once at launch: pull the stored token and check it is still
  /// valid. An expired or revoked token drops straight back to login.
  Future<void> restore() async {
    try {
      final String? base = await _storage.read(key: _keyBase);
      final String? token = await _storage.read(key: _keyToken);
      lastEmail = await _storage.read(key: _keyEmail) ?? "";

      api = Api(baseUrl: base ?? defaultBaseUrl, token: token);

      if (token != null) {
        final Map<String, dynamic> me = await api.me();
        admin = Map<String, dynamic>.from(me["admin"] as Map<dynamic, dynamic>);
        backend = me["backend"]?.toString();
        capabilities = me["capabilities"] == null
            ? null
            : Map<String, dynamic>.from(me["capabilities"] as Map<dynamic, dynamic>);
      }
    } on ApiException catch (e) {
      if (e.isAuth) {
        await _storage.delete(key: _keyToken);
        api.token = null;
      } else {
        restoreError = e.message;
      }
    } catch (e) {
      // Server unreachable at launch is not an error worth blocking on;
      // the login screen will report it properly when they try.
      restoreError = e.toString();
    } finally {
      restoring = false;
      notifyListeners();
    }
  }

  Future<void> signIn({
    required String baseUrl,
    required String email,
    required String password,
  }) async {
    final Api candidate = Api(baseUrl: baseUrl.trim());
    final Map<String, dynamic> result = await candidate.login(email.trim(), password);

    final String token = result["token"].toString();
    candidate.token = token;

    api = candidate;
    admin = Map<String, dynamic>.from(result["admin"] as Map<dynamic, dynamic>);
    lastEmail = email.trim();

    await _storage.write(key: _keyToken, value: token);
    await _storage.write(key: _keyBase, value: candidate.baseUrl);
    await _storage.write(key: _keyEmail, value: lastEmail);

    try {
      final Map<String, dynamic> me = await api.me();
      backend = me["backend"]?.toString();
      capabilities = me["capabilities"] == null
          ? null
          : Map<String, dynamic>.from(me["capabilities"] as Map<dynamic, dynamic>);
    } catch (_) {
      // Non-fatal: the extra detail is nice to have, not required.
    }

    notifyListeners();
  }

  Future<void> signOut() async {
    await _storage.delete(key: _keyToken);
    api.token = null;
    admin = null;
    capabilities = null;
    notifyListeners();
  }

  /// Wraps a call so an expired token signs the user out instead of
  /// leaving them staring at a permission error.
  Future<T> guard<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on ApiException catch (e) {
      if (e.isAuth) await signOut();
      rethrow;
    }
  }
}

class SessionScope extends InheritedNotifier<Session> {
  const SessionScope({super.key, required Session session, required super.child})
      : super(notifier: session);

  static Session of(BuildContext context) {
    final SessionScope? scope =
        context.dependOnInheritedWidgetOfExactType<SessionScope>();
    assert(scope != null, "SessionScope is missing from the widget tree");
    return scope!.notifier!;
  }
}
