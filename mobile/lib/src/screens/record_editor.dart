import "package:flutter/material.dart";

import "../api.dart";
import "../session.dart";
import "../theme.dart";
import "../widgets/field_input.dart";

/// Builds its entire form from the schema the server sent, so a field
/// added on the web appears here without an app release.
class RecordEditorScreen extends StatefulWidget {
  const RecordEditorScreen({
    super.key,
    required this.schema,
    required this.record,
    required this.previousId,
  });

  final Map<String, dynamic> schema;
  final Map<String, dynamic> record;
  final String? previousId;

  @override
  State<RecordEditorScreen> createState() => _RecordEditorScreenState();
}

class _RecordEditorScreenState extends State<RecordEditorScreen> {
  late Map<String, dynamic> _draft =
      Map<String, dynamic>.from(widget.record);
  bool _saving = false;
  bool _dirty = false;

  String get _name => widget.schema["name"].toString();
  bool get _singleton => widget.schema["singleton"] == true;
  String get _idField => widget.schema["idField"].toString();

  List<Map<String, dynamic>> get _fields => <Map<String, dynamic>>[
        for (final dynamic f in (widget.schema["fields"] as List<dynamic>? ?? <dynamic>[]))
          Map<String, dynamic>.from(f as Map<dynamic, dynamic>),
      ];

  String? _validate() {
    for (final Map<String, dynamic> f in _fields) {
      if (f["required"] != true) continue;
      final dynamic v = _draft[f["key"].toString()];
      if (v == null || v.toString().trim().isEmpty) {
        return "${f["label"]} is required";
      }
    }
    return null;
  }

  Future<void> _save() async {
    final String? problem = _validate();
    if (problem != null) {
      _toast(problem, error: true);
      return;
    }

    setState(() => _saving = true);
    final Session session = SessionScope.of(context);
    try {
      await session.guard(() => session.api.saveRecord(
            _name,
            _draft,
            previousId: _singleton ? null : widget.previousId,
          ));
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      _toast(e.toString(), error: true);
    } catch (e) {
      _toast(e.toString(), error: true);
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

  Future<bool> _confirmDiscard() async {
    if (!_dirty) return true;
    final bool? leave = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) => AlertDialog(
        title: const Text("Discard changes?", style: TextStyle(fontSize: 17)),
        content: const Text(
          "Nothing has been saved yet.",
          style: TextStyle(color: Palette.dim, fontSize: 14),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text("Keep editing", style: TextStyle(color: Palette.dim)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("Discard", style: TextStyle(color: Palette.dead)),
          ),
        ],
      ),
    );
    return leave ?? false;
  }

  @override
  Widget build(BuildContext context) {
    final String title = _singleton
        ? widget.schema["label"].toString()
        : (_draft[widget.schema["titleField"].toString()]?.toString().isNotEmpty == true
            ? _draft[widget.schema["titleField"].toString()].toString()
            : "New ${widget.schema["label"].toString().replaceAll(RegExp(r"s$"), "")}");

    return PopScope<Object?>(
      canPop: !_dirty,
      onPopInvokedWithResult: (bool didPop, Object? result) async {
        if (didPop) return;
        if (await _confirmDiscard() && mounted) {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(title, overflow: TextOverflow.ellipsis),
          actions: <Widget>[
            TextButton(
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(
                      width: 15,
                      height: 15,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Palette.signal),
                    )
                  : const Text("Save",
                      style: TextStyle(
                          color: Palette.signal, fontWeight: FontWeight.w600)),
            ),
            const SizedBox(width: 6),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 60),
          children: <Widget>[
            if (!_singleton && widget.previousId != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 18),
                child: Text(
                  "editing ${widget.previousId} — changing $_idField moves the record and its URL",
                  style: monoStyle.copyWith(fontSize: 10.5, height: 1.6),
                ),
              ),
            for (final Map<String, dynamic> f in _fields)
              FieldInput(
                field: f,
                value: _draft[f["key"].toString()],
                onChanged: (dynamic v) => setState(() {
                  _draft[f["key"].toString()] = v;
                  _dirty = true;
                }),
              ),
            if (_fields.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 30),
                child: Text(
                  "This collection has no simple fields — edit it on the web, "
                  "or use the raw JSON editor there.",
                  style: monoStyle.copyWith(fontSize: 11.5, height: 1.7),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
