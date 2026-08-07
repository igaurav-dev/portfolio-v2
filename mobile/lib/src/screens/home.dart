import "package:flutter/material.dart";

import "../api.dart";
import "../session.dart";
import "../theme.dart";
import "account.dart";
import "collection_list.dart";
import "planner.dart";
import "resume.dart";

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<Map<String, dynamic>> _collections = <Map<String, dynamic>>[];
  Map<String, int> _counts = <String, int>{};
  Map<String, dynamic>? _health;
  Map<String, dynamic>? _day;
  bool _loading = true;
  String? _error;

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

  Future<void> _load() async {
    final Session session = SessionScope.of(context);
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final List<dynamic> schema = await session.guard(() => session.api.schema());
      final List<Map<String, dynamic>> collections = <Map<String, dynamic>>[
        for (final dynamic c in schema) Map<String, dynamic>.from(c as Map<dynamic, dynamic>),
      ];

      final Map<String, int> counts = <String, int>{};
      for (final Map<String, dynamic> c in collections) {
        try {
          final Map<String, dynamic> res =
              await session.api.records(c["name"].toString());
          final dynamic data = res["data"];
          counts[c["name"].toString()] = data is List
              ? data.length
              : (data is Map && data.isNotEmpty ? 1 : 0);
        } catch (_) {
          counts[c["name"].toString()] = 0;
        }
      }

      Map<String, dynamic>? health;
      Map<String, dynamic>? day;
      try {
        health = await session.api.health();
      } catch (_) {}
      try {
        day = await session.api.dayStatus();
      } catch (_) {}

      if (!mounted) return;
      setState(() {
        _collections = collections;
        _counts = counts;
        _health = health;
        _day = day;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final Session session = SessionScope.of(context);
    final String email = session.admin?["email"]?.toString() ?? "";

    return Scaffold(
      appBar: AppBar(
        title: const Text("Admin"),
        actions: <Widget>[
          IconButton(
            tooltip: "Account",
            icon: const Icon(Icons.person_outline, size: 21),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const AccountScreen()),
            ),
          ),
          IconButton(
            tooltip: "Refresh",
            icon: const Icon(Icons.refresh, size: 21),
            onPressed: _load,
          ),
        ],
      ),
      body: RefreshIndicator(
        color: Palette.signal,
        backgroundColor: Palette.panel,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 40),
          children: <Widget>[
            _StatusCard(health: _health, day: _day, email: email, backend: session.backend),

            if (_error != null) ...<Widget>[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.only(left: 12),
                decoration: const BoxDecoration(
                  border: Border(left: BorderSide(color: Palette.dead, width: 2)),
                ),
                child: Text(_error!,
                    style: const TextStyle(color: Palette.dead, fontSize: 13)),
              ),
            ],

            const SizedBox(height: 26),
            const MonoLabel("manage content"),
            const SizedBox(height: 10),

            if (_loading && _collections.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Center(
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Palette.signal),
                  ),
                ),
              )
            else
              ..._collections.map((Map<String, dynamic> c) {
                final String name = c["name"].toString();
                return _Row(
                  title: c["label"].toString(),
                  subtitle: c["description"].toString(),
                  trailing: (_counts[name] ?? 0).toString(),
                  onTap: () async {
                    await Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => CollectionScreen(schema: c),
                      ),
                    );
                    _load();
                  },
                );
              }),

            const SizedBox(height: 26),
            const MonoLabel("tools"),
            const SizedBox(height: 10),
            _Row(
              title: "Day planner",
              subtitle: "Routine blocks, derived free time, daily check-ins.",
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const PlannerScreen()),
              ),
            ),
            _Row(
              title: "Résumé ingest",
              subtitle:
                  "Upload a PDF, extract it with Claude, review the diff, apply what you want.",
              trailing: session.capabilities?["synthesis"] == true ? null : "no key",
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const ResumeScreen()),
              ),
            ),

            const SizedBox(height: 30),
            Text(
              "Changes are live on the site as soon as they save — every page "
              "reads its content from the store on each request.",
              style: monoStyle.copyWith(fontSize: 10.5, height: 1.7),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.health,
    required this.day,
    required this.email,
    required this.backend,
  });

  final Map<String, dynamic>? health;
  final Map<String, dynamic>? day;
  final String email;
  final String? backend;

  @override
  Widget build(BuildContext context) {
    final String status = health?["status"]?.toString() ?? "…";
    final bool ok = status == "ok";
    final Map<String, dynamic>? store = health?["store"] == null
        ? null
        : Map<String, dynamic>.from(health!["store"] as Map<dynamic, dynamic>);
    final Map<String, dynamic>? current = day?["current"] == null
        ? null
        : Map<String, dynamic>.from(day!["current"] as Map<dynamic, dynamic>);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Palette.panel,
        border: Border.all(color: Palette.line),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                width: 7,
                height: 7,
                decoration: BoxDecoration(
                  color: ok ? Palette.signal : Palette.dead,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 9),
              MonoLabel(status, color: ok ? Palette.signal : Palette.dead),
              const Spacer(),
              MonoLabel(store?["backend"]?.toString() ?? backend ?? ""),
            ],
          ),
          const SizedBox(height: 12),
          Text(email, style: const TextStyle(color: Palette.ink, fontSize: 14.5)),
          if (current != null) ...<Widget>[
            const SizedBox(height: 14),
            const Divider(height: 1, color: Palette.line),
            const SizedBox(height: 14),
            const MonoLabel("right now"),
            const SizedBox(height: 5),
            Text(
              current["label"].toString(),
              style: const TextStyle(
                color: Palette.ink,
                fontSize: 17,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.3,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              "${current["start"]}–${current["end"]} · ${current["remaining"]} left"
              "${day?["next"] != null ? " · next ${(day!["next"] as Map<dynamic, dynamic>)["label"]}" : ""}",
              style: monoStyle.copyWith(fontSize: 10.5),
            ),
          ],
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.trailing,
  });

  final String title;
  final String subtitle;
  final String? trailing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: Palette.line)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    title,
                    style: const TextStyle(
                      color: Palette.ink,
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Palette.dim,
                      fontSize: 12.5,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            if (trailing != null) ...<Widget>[
              const SizedBox(width: 12),
              Text(
                trailing!,
                style: monoStyle.copyWith(color: Palette.signal, fontSize: 13),
              ),
            ],
            const SizedBox(width: 6),
            const Icon(Icons.chevron_right, size: 19, color: Palette.faint),
          ],
        ),
      ),
    );
  }
}
