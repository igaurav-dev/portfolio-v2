import "package:flutter/material.dart";

import "../api.dart";
import "../session.dart";
import "../theme.dart";

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _base = TextEditingController();
  final TextEditingController _email = TextEditingController();
  final TextEditingController _password = TextEditingController();

  bool _busy = false;
  bool _obscure = true;
  String? _error;
  String? _hint;

  bool _initialised = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialised) return;
    _initialised = true;
    final Session session = SessionScope.of(context);
    _base.text = session.baseUrl;
    _email.text = session.lastEmail;
  }

  @override
  void dispose() {
    _base.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
      _hint = null;
    });

    final Session session = SessionScope.of(context);

    try {
      // Check reachability first so a wrong host does not look like a
      // wrong password.
      final Api probe = Api(baseUrl: _base.text.trim());
      if (!await probe.reachable()) {
        throw ApiException(0, "cannot reach ${_base.text.trim()}",
            hint: "check the address, and that the server is running");
      }

      await session.signIn(
        baseUrl: _base.text,
        email: _email.text,
        password: _password.text,
      );
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _hint = e.hint;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Container(
                        width: 7,
                        height: 7,
                        decoration: const BoxDecoration(
                          color: Palette.signal,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 10),
                      const MonoLabel("restricted", color: Palette.signal),
                    ],
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    "Portfolio admin",
                    style: TextStyle(
                      fontSize: 27,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.8,
                      color: Palette.ink,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    "Content, the day planner and résumé ingestion.",
                    style: TextStyle(color: Palette.dim, fontSize: 14, height: 1.45),
                  ),
                  const SizedBox(height: 28),

                  const MonoLabel("server"),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _base,
                    keyboardType: TextInputType.url,
                    autocorrect: false,
                    style: const TextStyle(color: Palette.ink, fontSize: 14),
                    decoration: const InputDecoration(hintText: "https://igaurav.dev"),
                  ),
                  const SizedBox(height: 16),

                  const MonoLabel("email"),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    autofillHints: const <String>[AutofillHints.username],
                    style: const TextStyle(color: Palette.ink, fontSize: 15),
                  ),
                  const SizedBox(height: 16),

                  const MonoLabel("password"),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _password,
                    obscureText: _obscure,
                    autofillHints: const <String>[AutofillHints.password],
                    onSubmitted: (_) => _submit(),
                    style: const TextStyle(color: Palette.ink, fontSize: 15),
                    decoration: InputDecoration(
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                          size: 19,
                          color: Palette.faint,
                        ),
                        onPressed: () => setState(() => _obscure = !_obscure),
                      ),
                    ),
                  ),
                  const SizedBox(height: 22),

                  FilledButton(
                    onPressed: _busy ? null : _submit,
                    child: _busy
                        ? const SizedBox(
                            width: 17,
                            height: 17,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Palette.bg,
                            ),
                          )
                        : const Text("Sign in"),
                  ),

                  if (_error != null) ...<Widget>[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.only(left: 12),
                      decoration: const BoxDecoration(
                        border: Border(left: BorderSide(color: Palette.dead, width: 2)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            _error!,
                            style: const TextStyle(color: Palette.dead, fontSize: 13),
                          ),
                          if (_hint != null) ...<Widget>[
                            const SizedBox(height: 6),
                            Text(
                              _hint!,
                              style: const TextStyle(
                                color: Palette.faint,
                                fontSize: 12.5,
                                height: 1.45,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 34),
                  Text(
                    "The first account is created from ADMIN_EMAIL and "
                    "ADMIN_PASSWORD the first time the server starts against "
                    "an empty store. Use 10.0.2.2 for a local server from the "
                    "Android emulator.",
                    style: monoStyle.copyWith(fontSize: 10.5, height: 1.7),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
