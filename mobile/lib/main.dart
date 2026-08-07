import "package:flutter/material.dart";

import "src/session.dart";
import "src/theme.dart";
import "src/screens/home.dart";
import "src/screens/login.dart";

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const PortfolioAdminApp());
}

class PortfolioAdminApp extends StatefulWidget {
  const PortfolioAdminApp({super.key});

  @override
  State<PortfolioAdminApp> createState() => _PortfolioAdminAppState();
}

class _PortfolioAdminAppState extends State<PortfolioAdminApp> {
  final Session _session = Session();

  @override
  void initState() {
    super.initState();
    _session.restore();
  }

  @override
  void dispose() {
    _session.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SessionScope(
      session: _session,
      child: MaterialApp(
        title: "Portfolio Admin",
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        home: const _Root(),
      ),
    );
  }
}

class _Root extends StatelessWidget {
  const _Root();

  @override
  Widget build(BuildContext context) {
    final Session session = SessionScope.of(context);

    if (session.restoring) {
      return const Scaffold(
        body: Center(
          child: SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(strokeWidth: 2, color: Palette.signal),
          ),
        ),
      );
    }

    return session.signedIn ? const HomeScreen() : const LoginScreen();
  }
}
