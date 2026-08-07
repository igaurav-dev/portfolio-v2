import "package:flutter/material.dart";

import "../api.dart";
import "../session.dart";
import "../theme.dart";
import "record_editor.dart";

class CollectionScreen extends StatefulWidget {
  const CollectionScreen({super.key, required this.schema});

  final Map<String, dynamic> schema;

  @override
  State<CollectionScreen> createState() => _CollectionScreenState();
}

class _CollectionScreenState extends State<CollectionScreen> {
  List<Map<String, dynamic>> _rows = <Map<String, dynamic>>[];
  Map<String, dynamic> _single = <String, dynamic>{};
  bool _loading = true;
  String? _error;
  String _filter = "";

  String get _name => widget.schema["name"].toString();
  bool get _singleton => widget.schema["singleton"] == true;
  String get _idField => widget.schema["idField"].toString();
  String get _titleField => widget.schema["titleField"].toString();
  String? get _subtitleField => widget.schema["subtitleField"]?.toString();

  List<Map<String, dynamic>> get _fields => <Map<String, dynamic>>[
        for (final dynamic f in (widget.schema["fields"] as List<dynamic>? ?? <dynamic>[]))
          Map<String, dynamic>.from(f as Map<dynamic, dynamic>),
      ];

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
      final Map<String, dynamic> res =
          await session.guard(() => session.api.records(_name));
      final dynamic data = res["data"];
      if (!mounted) return;
      setState(() {
        if (_singleton) {
          _single = data is Map
              ? Map<String, dynamic>.from(data as Map<dynamic, dynamic>)
              : <String, dynamic>{};
        } else {
          _rows = <Map<String, dynamic>>[
            for (final dynamic r in (data as List<dynamic>? ?? <dynamic>[]))
              Map<String, dynamic>.from(r as Map<dynamic, dynamic>),
          ];
        }
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _open(Map<String, dynamic>? row) async {
    final bool? saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => RecordEditorScreen(
          schema: widget.schema,
          record: row ??
              Map<String, dynamic>.from(
                  widget.schema["blank"] as Map<dynamic, dynamic>? ?? <dynamic, dynamic>{}),
          previousId: row?[_idField]?.toString(),
        ),
      ),
    );
    if (saved == true) _load();
  }

  Future<void> _delete(Map<String, dynamic> row) async {
    final String id = row[_idField].toString();
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) => AlertDialog(
        title: const Text("Delete?", style: TextStyle(fontSize: 17)),
        content: Text(
          "\"${row[_titleField] ?? id}\" will be removed. This cannot be undone.",
          style: const TextStyle(color: Palette.dim, fontSize: 14),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text("Cancel", style: TextStyle(color: Palette.dim)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("Delete", style: TextStyle(color: Palette.dead)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    final Session session = SessionScope.of(context);
    try {
      await session.guard(() => session.api.deleteRecord(_name, id));
      _load();
    } on ApiException catch (e) {
      _toast(e.message, error: true);
    }
  }

  Future<void> _move(Map<String, dynamic> row, int direction) async {
    final Session session = SessionScope.of(context);
    try {
      await session.guard(
          () => session.api.reorder(_name, row[_idField].toString(), direction));
      _load();
    } on ApiException catch (e) {
      _toast(e.message, error: true);
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
    final List<Map<String, dynamic>> visible = _filter.isEmpty
        ? _rows
        : _rows
            .where((Map<String, dynamic> r) =>
                r.toString().toLowerCase().contains(_filter.toLowerCase()))
            .toList();

    return Scaffold(
      appBar: AppBar(title: Text(widget.schema["label"].toString())),
      floatingActionButton: _singleton
          ? null
          : FloatingActionButton.extended(
              backgroundColor: Palette.signal,
              foregroundColor: Palette.bg,
              onPressed: () => _open(null),
              icon: const Icon(Icons.add, size: 19),
              label: const Text("New"),
            ),
      body: _loading
          ? const Center(
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: Palette.signal),
              ),
            )
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(_error!,
                        style: const TextStyle(color: Palette.dead, fontSize: 13.5)),
                  ),
                )
              : _singleton
                  ? _SingletonBody(
                      schema: widget.schema,
                      record: _single,
                      onEdited: _load,
                    )
                  : RefreshIndicator(
                      color: Palette.signal,
                      backgroundColor: Palette.panel,
                      onRefresh: _load,
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(18, 8, 18, 96),
                        children: <Widget>[
                          Text(
                            widget.schema["description"].toString(),
                            style: const TextStyle(
                                color: Palette.dim, fontSize: 13, height: 1.5),
                          ),
                          const SizedBox(height: 16),
                          if (_rows.length > 4)
                            TextField(
                              onChanged: (String v) => setState(() => _filter = v),
                              style: const TextStyle(color: Palette.ink, fontSize: 14),
                              decoration: const InputDecoration(
                                hintText: "filter",
                                prefixIcon:
                                    Icon(Icons.search, size: 18, color: Palette.faint),
                              ),
                            ),
                          if (_rows.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 4, bottom: 4),
                              child: Text(
                                "tap to edit · arrows reorder · long-press to delete",
                                style: monoStyle.copyWith(fontSize: 10),
                              ),
                            ),
                          const SizedBox(height: 4),
                          if (visible.isEmpty)
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 44),
                              child: Center(
                                child: Text(
                                  _rows.isEmpty
                                      ? "nothing here yet — tap New"
                                      : "nothing matches",
                                  style: monoStyle.copyWith(fontSize: 11.5),
                                ),
                              ),
                            ),
                          for (int i = 0; i < visible.length; i++)
                            _RecordTile(
                              row: visible[i],
                              titleField: _titleField,
                              subtitleField: _subtitleField,
                              summaryFields: _fields
                                  .where((Map<String, dynamic> f) =>
                                      f["summary"] == true &&
                                      f["key"].toString() != _titleField)
                                  .toList(),
                              first: i == 0,
                              last: i == visible.length - 1,
                              onTap: () => _open(visible[i]),
                              onUp: () => _move(visible[i], -1),
                              onDown: () => _move(visible[i], 1),
                              onDelete: () => _delete(visible[i]),
                            ),
                        ],
                      ),
                    ),
    );
  }
}

class _SingletonBody extends StatelessWidget {
  const _SingletonBody({
    required this.schema,
    required this.record,
    required this.onEdited,
  });

  final Map<String, dynamic> schema;
  final Map<String, dynamic> record;
  final VoidCallback onEdited;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 40),
      children: <Widget>[
        Text(
          schema["description"].toString(),
          style: const TextStyle(color: Palette.dim, fontSize: 13, height: 1.5),
        ),
        const SizedBox(height: 22),
        FilledButton(
          onPressed: () async {
            final bool? saved = await Navigator.of(context).push<bool>(
              MaterialPageRoute<bool>(
                builder: (_) => RecordEditorScreen(
                  schema: schema,
                  record: record,
                  previousId: null,
                ),
              ),
            );
            if (saved == true) onEdited();
          },
          child: const Text("Edit"),
        ),
        const SizedBox(height: 26),
        const MonoLabel("current values"),
        const SizedBox(height: 10),
        for (final MapEntry<String, dynamic> e in record.entries)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                MonoLabel(e.key),
                const SizedBox(height: 2),
                Text(
                  e.value is List
                      ? (e.value as List<dynamic>).join(", ")
                      : e.value.toString(),
                  style: const TextStyle(
                      color: Palette.dim, fontSize: 13, height: 1.45),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _RecordTile extends StatelessWidget {
  const _RecordTile({
    required this.row,
    required this.titleField,
    required this.subtitleField,
    required this.summaryFields,
    required this.first,
    required this.last,
    required this.onTap,
    required this.onUp,
    required this.onDown,
    required this.onDelete,
  });

  final Map<String, dynamic> row;
  final String titleField;
  final String? subtitleField;
  final List<Map<String, dynamic>> summaryFields;
  final bool first;
  final bool last;
  final VoidCallback onTap;
  final VoidCallback onUp;
  final VoidCallback onDown;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      onLongPress: onDelete,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 13),
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
                    (row[titleField] ?? "(untitled)").toString(),
                    style: const TextStyle(
                      color: Palette.ink,
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  if (summaryFields.isNotEmpty) ...<Widget>[
                    const SizedBox(height: 3),
                    Text(
                      summaryFields
                          .map((Map<String, dynamic> f) =>
                              (row[f["key"].toString()] ?? "").toString())
                          .where((String s) => s.isNotEmpty)
                          .join("  ·  "),
                      style: monoStyle.copyWith(fontSize: 10.5),
                    ),
                  ],
                  if (subtitleField != null) ...<Widget>[
                    const SizedBox(height: 4),
                    Text(
                      (row[subtitleField!] ?? "").toString(),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: Palette.dim, fontSize: 12.5, height: 1.4),
                    ),
                  ],
                ],
              ),
            ),
            Column(
              children: <Widget>[
                SizedBox(
                  height: 26,
                  child: IconButton(
                    padding: EdgeInsets.zero,
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.arrow_upward, size: 16, color: Palette.faint),
                    onPressed: first ? null : onUp,
                  ),
                ),
                SizedBox(
                  height: 26,
                  child: IconButton(
                    padding: EdgeInsets.zero,
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.arrow_downward, size: 16, color: Palette.faint),
                    onPressed: last ? null : onDown,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
