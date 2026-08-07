import "package:flutter/material.dart";

import "../api.dart";
import "../session.dart";
import "../theme.dart";

const List<String> _dayNames = <String>["S", "M", "T", "W", "T", "F", "S"];
const List<String> _categories = <String>[
  "health",
  "trading",
  "work",
  "learning",
  "building",
  "rest",
];

const Map<String, Color> _categoryColor = <String, Color>{
  "health": Color(0xFF6EE7B7),
  "trading": Color(0xFFFBBF24),
  "work": Color(0xFF7DD3FC),
  "learning": Color(0xFFC4B5FD),
  "building": Palette.signal,
  "rest": Color(0xFF4B4B55),
};

class PlannerScreen extends StatefulWidget {
  const PlannerScreen({super.key});

  @override
  State<PlannerScreen> createState() => _PlannerScreenState();
}

class _PlannerScreenState extends State<PlannerScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);

  Map<String, dynamic> _routine = <String, dynamic>{};
  List<Map<String, dynamic>> _blocks = <Map<String, dynamic>>[];
  Map<String, dynamic> _freeByDay = <String, dynamic>{};

  Map<String, dynamic>? _checkins;
  bool _loading = true;
  bool _saving = false;
  bool _dirty = false;

  bool _initialised = false;

  @override
  void initState() {
    super.initState();
    _tabs.addListener(() => setState(() {}));
  }

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
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final Session session = SessionScope.of(context);
    setState(() => _loading = true);
    try {
      final Map<String, dynamic> res =
          await session.guard(() => session.api.routine());
      final Map<String, dynamic> routine =
          Map<String, dynamic>.from(res["routine"] as Map<dynamic, dynamic>);

      Map<String, dynamic>? checkins;
      try {
        checkins = await session.api.checkins();
      } catch (_) {}

      if (!mounted) return;
      setState(() {
        _routine = routine;
        _blocks = <Map<String, dynamic>>[
          for (final dynamic b in (routine["blocks"] as List<dynamic>? ?? <dynamic>[]))
            Map<String, dynamic>.from(b as Map<dynamic, dynamic>),
        ];
        _freeByDay = Map<String, dynamic>.from(
            res["freeByDay"] as Map<dynamic, dynamic>? ?? <dynamic, dynamic>{});
        _checkins = checkins;
        _dirty = false;
      });
    } on ApiException catch (e) {
      _toast(e.message, error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final Session session = SessionScope.of(context);
    try {
      await session.guard(() => session.api.saveRoutine(<String, dynamic>{
            "timezone": _routine["timezone"],
            "label": _routine["label"],
            "blocks": _blocks,
          }));
      _toast("routine saved — /day is live with the change");
      await _load();
    } on ApiException catch (e) {
      // Overlap and format errors come back from the server with a
      // readable message; show it verbatim rather than "save failed".
      _toast(e.message, error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
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

  Future<void> _pickTime(int index, String key) async {
    final String current = _blocks[index][key].toString();
    final List<String> parts = current.split(":");
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: int.tryParse(parts.first) ?? 9,
        minute: int.tryParse(parts.length > 1 ? parts[1] : "0") ?? 0,
      ),
      builder: (BuildContext ctx, Widget? child) => MediaQuery(
        data: MediaQuery.of(ctx).copyWith(alwaysUse24HourFormat: true),
        child: child ?? const SizedBox.shrink(),
      ),
    );
    if (picked == null) return;
    setState(() {
      _blocks[index][key] =
          "${picked.hour.toString().padLeft(2, "0")}:${picked.minute.toString().padLeft(2, "0")}";
      _dirty = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Day planner"),
        bottom: TabBar(
          controller: _tabs,
          indicatorColor: Palette.signal,
          labelColor: Palette.ink,
          unselectedLabelColor: Palette.faint,
          labelStyle: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
          tabs: const <Widget>[Tab(text: "Blocks"), Tab(text: "Check in")],
        ),
        actions: <Widget>[
          TextButton(
            onPressed: _saving || !_dirty ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 15,
                    height: 15,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Palette.signal),
                  )
                : Text(
                    "Save",
                    style: TextStyle(
                      color: _dirty ? Palette.signal : Palette.faint,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
          ),
          const SizedBox(width: 6),
        ],
      ),
      floatingActionButton: _tabs.index == 0
          ? FloatingActionButton.extended(
              backgroundColor: Palette.signal,
              foregroundColor: Palette.bg,
              onPressed: () => setState(() {
                _blocks.add(<String, dynamic>{
                  "id": "block-${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}",
                  "label": "New block",
                  "start": "09:00",
                  "end": "10:00",
                  "category": "learning",
                  "days": <int>[1, 2, 3, 4, 5],
                  "note": "",
                });
                _dirty = true;
              }),
              icon: const Icon(Icons.add, size: 19),
              label: const Text("Block"),
            )
          : null,
      body: _loading
          ? const Center(
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: Palette.signal),
              ),
            )
          : TabBarView(
              controller: _tabs,
              children: <Widget>[_blocksTab(), _checkinTab()],
            ),
    );
  }

  Widget _blocksTab() {
    final int freeMinutes = <int>[
      for (final dynamic gap in (_freeByDay["1"] as List<dynamic>? ?? <dynamic>[]))
        ((gap as Map<dynamic, dynamic>)["minutes"] as num).toInt(),
    ].fold<int>(0, (int a, int b) => a + b);

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
      children: <Widget>[
        Text(
          "Blocks are declared; free time is derived. Anything no block covers "
          "shows up on /day as an unclaimed gap — on a weekday that is currently "
          "${freeMinutes}m.",
          style: const TextStyle(color: Palette.dim, fontSize: 13, height: 1.5),
        ),
        const SizedBox(height: 6),
        Text("${_routine["timezone"] ?? ""} · ${_blocks.length} blocks",
            style: monoStyle.copyWith(fontSize: 10.5)),
        const SizedBox(height: 18),
        for (int i = 0; i < _blocks.length; i++) _blockCard(i),
      ],
    );
  }

  Widget _blockCard(int i) {
    final Map<String, dynamic> b = _blocks[i];
    final String category = b["category"].toString();
    final List<int> days = <int>[
      for (final dynamic d in (b["days"] as List<dynamic>? ?? <dynamic>[]))
        (d as num).toInt(),
    ];

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
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
                width: 9,
                height: 9,
                decoration: BoxDecoration(
                  color: _categoryColor[category] ?? Palette.faint,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextFormField(
                  initialValue: b["label"].toString(),
                  onChanged: (String v) => setState(() {
                    _blocks[i]["label"] = v;
                    _dirty = true;
                  }),
                  style: const TextStyle(
                      color: Palette.ink, fontSize: 15, fontWeight: FontWeight.w500),
                  decoration: const InputDecoration(
                    filled: false,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              ),
              IconButton(
                visualDensity: VisualDensity.compact,
                icon: const Icon(Icons.delete_outline, size: 19, color: Palette.dead),
                onPressed: () => setState(() {
                  _blocks.removeAt(i);
                  _dirty = true;
                }),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: <Widget>[
              _timeChip(b["start"].toString(), () => _pickTime(i, "start")),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 8),
                child: Text("–", style: TextStyle(color: Palette.faint)),
              ),
              _timeChip(b["end"].toString(), () => _pickTime(i, "end")),
              const Spacer(),
              DropdownButton<String>(
                value: _categories.contains(category) ? category : null,
                dropdownColor: Palette.panel,
                underline: const SizedBox.shrink(),
                isDense: true,
                style: monoStyle.copyWith(color: Palette.dim, fontSize: 11.5),
                items: <DropdownMenuItem<String>>[
                  for (final String c in _categories)
                    DropdownMenuItem<String>(value: c, child: Text(c)),
                ],
                onChanged: (String? v) => setState(() {
                  _blocks[i]["category"] = v ?? "learning";
                  _dirty = true;
                }),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            children: <Widget>[
              for (int d = 0; d < 7; d++)
                GestureDetector(
                  onTap: () => setState(() {
                    final List<int> next = <int>[...days];
                    if (next.contains(d)) {
                      next.remove(d);
                    } else {
                      next.add(d);
                      next.sort();
                    }
                    _blocks[i]["days"] = next;
                    _dirty = true;
                  }),
                  child: Container(
                    width: 30,
                    height: 30,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: days.contains(d) ? Palette.signal : Palette.line,
                      ),
                      borderRadius: BorderRadius.circular(5),
                    ),
                    child: Text(
                      _dayNames[d],
                      style: TextStyle(
                        color: days.contains(d) ? Palette.signal : Palette.faint,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          TextFormField(
            initialValue: b["note"]?.toString() ?? "",
            onChanged: (String v) => setState(() {
              _blocks[i]["note"] = v;
              _dirty = true;
            }),
            maxLines: 2,
            minLines: 1,
            style: const TextStyle(color: Palette.dim, fontSize: 12.5, height: 1.4),
            decoration: const InputDecoration(hintText: "note shown on the dial"),
          ),
        ],
      ),
    );
  }

  Widget _timeChip(String value, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(5),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          border: Border.all(color: Palette.lineBright),
          borderRadius: BorderRadius.circular(5),
        ),
        child: Text(
          value,
          style: monoStyle.copyWith(color: Palette.ink, fontSize: 13),
        ),
      ),
    );
  }

  Widget _checkinTab() {
    if (_checkins == null) {
      return Center(
        child: Text("no check-in data", style: monoStyle.copyWith(fontSize: 11.5)),
      );
    }

    final String date = _checkins!["date"].toString();
    final List<Map<String, dynamic>> blocks = <Map<String, dynamic>>[
      for (final dynamic b in (_checkins!["blocks"] as List<dynamic>? ?? <dynamic>[]))
        Map<String, dynamic>.from(b as Map<dynamic, dynamic>),
    ];
    final List<Map<String, dynamic>> entries = <Map<String, dynamic>>[
      for (final dynamic e in (_checkins!["entries"] as List<dynamic>? ?? <dynamic>[]))
        Map<String, dynamic>.from(e as Map<dynamic, dynamic>),
    ];

    String? statusOf(String id) {
      for (final Map<String, dynamic> e in entries) {
        if (e["blockId"] == id) return e["status"].toString();
      }
      return null;
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
      children: <Widget>[
        Text(date, style: monoStyle.copyWith(color: Palette.signal, fontSize: 12)),
        const SizedBox(height: 6),
        Text(
          "Marking blocks feeds the streak and the 7- and 30-day charts on /day. "
          "Sleep is excluded from scoring.",
          style: const TextStyle(color: Palette.dim, fontSize: 13, height: 1.5),
        ),
        const SizedBox(height: 20),
        for (final Map<String, dynamic> b in blocks)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(b["label"].toString(),
                          style: const TextStyle(color: Palette.ink, fontSize: 14)),
                      const SizedBox(height: 2),
                      Text("${b["start"]}–${b["end"]}",
                          style: monoStyle.copyWith(fontSize: 10.5)),
                    ],
                  ),
                ),
                for (final String s in <String>["done", "partial", "skipped"])
                  Padding(
                    padding: const EdgeInsets.only(left: 6),
                    child: GestureDetector(
                      onTap: () => _mark(date, b["id"].toString(), s, statusOf(b["id"].toString())),
                      child: Container(
                        width: 34,
                        height: 30,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: statusOf(b["id"].toString()) == s
                                ? (s == "skipped" ? Palette.dead : Palette.signal)
                                : Palette.line,
                          ),
                          borderRadius: BorderRadius.circular(5),
                        ),
                        child: Text(
                          s[0].toUpperCase(),
                          style: TextStyle(
                            color: statusOf(b["id"].toString()) == s
                                ? (s == "skipped" ? Palette.dead : Palette.signal)
                                : Palette.faint,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        const SizedBox(height: 10),
        Text("D done · P partial · S skipped · tap again to clear",
            style: monoStyle.copyWith(fontSize: 10.5)),
      ],
    );
  }

  Future<void> _mark(String date, String blockId, String status, String? currentStatus) async {
    final Session session = SessionScope.of(context);
    try {
      if (currentStatus == status) {
        await session.guard(() => session.api.clearCheckin(date, blockId));
      } else {
        await session.guard(() => session.api.checkin(date, blockId, status));
      }
      final Map<String, dynamic> fresh = await session.api.checkins();
      if (mounted) setState(() => _checkins = fresh);
    } on ApiException catch (e) {
      _toast(e.message, error: true);
    }
  }
}
