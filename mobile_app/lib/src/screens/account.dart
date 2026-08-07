import "package:flutter/material.dart";

import "../api.dart";
import "../session.dart";
import "../theme.dart";

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  final TextEditingController _name = TextEditingController();
  final TextEditingController _email = TextEditingController();
  final TextEditingController _current = TextEditingController();
  final TextEditingController _next = TextEditingController();
  final TextEditingController _confirm = TextEditingController();

  Map<String, dynamic>? _admin;
  bool _busy = false;

  bool _initialised = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // SessionScope is an InheritedWidget, so it cannot be read during
    // initState. This is the earliest safe point, guarded so it only
    // runs once.
    if (_initialised) return;
    _initialised = true;
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final Session session = SessionScope.of(context);
    try {
      final Map<String, dynamic> res =
          await session.guard(() => session.api.account());
      if (!mounted) return;
      setState(() {
        _admin = Map<String, dynamic>.from(res["admin"] as Map<dynamic, dynamic>);
        _name.text = _admin!["name"].toString();
        _email.text = _admin!["email"].toString();
      });
    } on ApiException catch (e) {
      _toast(e.message, error: true);
    }
  }

  Future<void> _save({required bool withPassword}) async {
    if (withPassword && _next.text != _confirm.text) {
      _toast("the two new passwords do not match", error: true);
      return;
    }
    setState(() => _busy = true);
    final Session session = SessionScope.of(context);
    try {
      final Map<String, dynamic> res = await session.guard(
        () => session.api.updateAccount(<String, dynamic>{
          "name": _name.text.trim(),
          "email": _email.text.trim(),
          if (withPassword) "currentPassword": _current.text,
          if (withPassword) "newPassword": _next.text,
        }),
      );
      _current.clear();
      _next.clear();
      _confirm.clear();
      _toast(res["note"]?.toString() ?? "account updated");
      _load();
    } on ApiException catch (e) {
      _toast(e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _toast(String message, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: error ? Palette.dead : Palette.raised,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final Session session = SessionScope.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text("Account")),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 40),
        children: <Widget>[
          Text(
            "Credentials live in the same database as the content, hashed with "
            "PBKDF2. The environment variables only create the first account — "
            "once you change the password here, they stop being the way in.",
            style: const TextStyle(color: Palette.dim, fontSize: 13, height: 1.5),
          ),
          if (_admin != null) ...<Widget>[
            const SizedBox(height: 14),
            Text(
              "signed in since ${_admin!["lastLoginAt"] ?? "—"} · created ${_admin!["createdAt"].toString().substring(0, 10)} · ${_admin!["source"]}",
              style: monoStyle.copyWith(fontSize: 10.5, height: 1.6),
            ),
          ],
          const SizedBox(height: 26),

          const MonoLabel("name"),
          const SizedBox(height: 6),
          TextField(controller: _name, style: const TextStyle(color: Palette.ink, fontSize: 14)),
          const SizedBox(height: 16),
          const MonoLabel("email"),
          const SizedBox(height: 6),
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            style: const TextStyle(color: Palette.ink, fontSize: 14),
          ),
          const SizedBox(height: 18),
          FilledButton(
            onPressed: _busy ? null : () => _save(withPassword: false),
            child: const Text("Save details"),
          ),

          const SizedBox(height: 34),
          const Divider(height: 1, color: Palette.line),
          const SizedBox(height: 26),

          const MonoLabel("change password"),
          const SizedBox(height: 12),
          TextField(
            controller: _current,
            obscureText: true,
            decoration: const InputDecoration(labelText: "current password"),
            style: const TextStyle(color: Palette.ink, fontSize: 14),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _next,
            obscureText: true,
            decoration: const InputDecoration(labelText: "new password"),
            style: const TextStyle(color: Palette.ink, fontSize: 14),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _confirm,
            obscureText: true,
            decoration: const InputDecoration(labelText: "confirm new password"),
            style: const TextStyle(color: Palette.ink, fontSize: 14),
          ),
          const SizedBox(height: 8),
          Text("minimum 10 characters", style: monoStyle.copyWith(fontSize: 10.5)),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : () => _save(withPassword: true),
            child: const Text("Change password"),
          ),

          const SizedBox(height: 40),
          const Divider(height: 1, color: Palette.line),
          const SizedBox(height: 20),
          Text("connected to ${session.baseUrl}", style: monoStyle.copyWith(fontSize: 10.5)),
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: () async {
              await session.signOut();
              if (context.mounted) Navigator.of(context).popUntil((Route<dynamic> r) => r.isFirst);
            },
            icon: const Icon(Icons.logout, size: 17, color: Palette.dead),
            label: const Text("Sign out", style: TextStyle(color: Palette.dead)),
          ),
        ],
      ),
    );
  }
}
