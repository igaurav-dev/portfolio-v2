import "package:file_picker/file_picker.dart";
import "package:flutter/material.dart";

import "../api.dart";
import "../session.dart";
import "../theme.dart";

const List<List<String>> _sections = <List<String>>[
  <String>["profile", "Profile", "name, title, contact, summary"],
  <String>["skills", "Skills", "replaces the skill groups wholesale"],
  <String>["timeline", "Experience", "replaces employment history"],
  <String>[
    "projects",
    "Projects",
    "merges by slug — never overwrites trade-offs or what went wrong"
  ],
  <String>["delta", "Growth entry", "appends the diff to /growth"],
];

class ResumeScreen extends StatefulWidget {
  const ResumeScreen({super.key});

  @override
  State<ResumeScreen> createState() => _ResumeScreenState();
}

class _ResumeScreenState extends State<ResumeScreen> {
  List<Map<String, dynamic>> _uploads = <Map<String, dynamic>>[];
  Map<String, dynamic>? _extraction;
  Map<String, dynamic>? _delta;
  Map<String, dynamic>? _stats;
  final Set<String> _selected = <String>{"profile", "skills", "timeline", "projects", "delta"};

  String? _busy;
  String? _activeId;

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
    try {
      final List<dynamic> uploads = await session.guard(() => session.api.uploads());
      if (!mounted) return;
      setState(() {
        _uploads = <Map<String, dynamic>>[
          for (final dynamic u in uploads)
            Map<String, dynamic>.from(u as Map<dynamic, dynamic>),
        ];
      });
    } on ApiException catch (e) {
      _toast(e.message, error: true);
    }
  }

  Future<void> _pickAndUpload() async {
    final FilePickerResult? result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: <String>["pdf"],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;

    final PlatformFile file = result.files.first;
    setState(() => _busy = "uploading");
    final Session session = SessionScope.of(context);

    try {
      final Map<String, dynamic> res = await session.guard(
        () => session.api.uploadResume(
          filename: file.name,
          bytes: file.bytes,
          path: file.path,
        ),
      );
      final Map<String, dynamic> upload =
          Map<String, dynamic>.from(res["upload"] as Map<dynamic, dynamic>);
      _toast("stored ${upload["name"]}");
      await _load();
      await _extract(upload["id"].toString());
    } on ApiException catch (e) {
      _toast(e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _extract(String id) async {
    setState(() {
      _busy = "extracting";
      _activeId = id;
      _extraction = null;
      _delta = null;
    });
    final Session session = SessionScope.of(context);
    try {
      final Map<String, dynamic> res =
          await session.guard(() => session.api.extract(id));
      if (!mounted) return;
      setState(() {
        _extraction = Map<String, dynamic>.from(res["extraction"] as Map<dynamic, dynamic>);
        _delta = Map<String, dynamic>.from(res["delta"] as Map<dynamic, dynamic>);
        _stats = Map<String, dynamic>.from(res["stats"] as Map<dynamic, dynamic>);
      });
      _toast("extracted ${_stats!["projects"]} projects, ${_stats!["roles"]} roles");
    } on ApiException catch (e) {
      _toast(e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _apply() async {
    if (_extraction == null || _delta == null) return;
    setState(() => _busy = "applying");
    final Session session = SessionScope.of(context);
    try {
      final Map<String, dynamic> res = await session.guard(
        () => session.api.applyExtraction(
          extraction: _extraction!,
          delta: _delta!,
          sections: _selected.toList(),
        ),
      );
      final List<dynamic> written = res["written"] as List<dynamic>? ?? <dynamic>[];
      _toast("wrote ${written.join(", ")}");
    } on ApiException catch (e) {
      _toast(e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  void _toast(String message, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: error ? Palette.dead : Palette.raised,
        duration: Duration(seconds: error ? 6 : 3),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final Session session = SessionScope.of(context);
    final bool hasKey = session.capabilities?["synthesis"] == true;

    final List<String> learned = <String>[
      for (final dynamic l in (_delta?["learned"] as List<dynamic>? ?? <dynamic>[]))
        l.toString(),
    ];
    final List<String> added = <String>[
      for (final dynamic a in (_delta?["added"] as List<dynamic>? ?? <dynamic>[]))
        a.toString(),
    ];
    final List<String> changed = <String>[
      for (final dynamic c in (_delta?["changed"] as List<dynamic>? ?? <dynamic>[]))
        c.toString(),
    ];

    return Scaffold(
      appBar: AppBar(title: const Text("Résumé ingest")),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 40),
        children: <Widget>[
          const Text(
            "The PDF goes to Claude as a document — no text extraction step, so "
            "a two-column layout does not scramble. A tool schema stops it "
            "inventing any metric that is not literally in the file.",
            style: TextStyle(color: Palette.dim, fontSize: 13, height: 1.5),
          ),
          if (!hasKey) ...<Widget>[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.only(left: 12),
              decoration: const BoxDecoration(
                border: Border(left: BorderSide(color: Palette.dead, width: 2)),
              ),
              child: Text(
                "ANTHROPIC_API_KEY is not set on the server — upload works, "
                "extraction does not.",
                style: monoStyle.copyWith(fontSize: 11, height: 1.6),
              ),
            ),
          ],
          const SizedBox(height: 22),

          FilledButton.icon(
            onPressed: _busy != null ? null : _pickAndUpload,
            icon: _busy == "uploading"
                ? const SizedBox(
                    width: 15,
                    height: 15,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Palette.bg),
                  )
                : const Icon(Icons.upload_file, size: 18),
            label: Text(_busy == "uploading" ? "Uploading…" : "Choose a PDF"),
          ),

          if (_uploads.isNotEmpty) ...<Widget>[
            const SizedBox(height: 30),
            MonoLabel("${_uploads.length} stored"),
            const SizedBox(height: 8),
            for (final Map<String, dynamic> u in _uploads)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 11),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: Palette.line)),
                ),
                child: Row(
                  children: <Widget>[
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(u["name"].toString(),
                              style: const TextStyle(color: Palette.ink, fontSize: 13.5)),
                          const SizedBox(height: 2),
                          Text(
                            "${((u["bytes"] as num) / 1024).round()}KB · ${u["uploadedAt"].toString().substring(0, 10)}",
                            style: monoStyle.copyWith(fontSize: 10.5),
                          ),
                        ],
                      ),
                    ),
                    OutlinedButton(
                      onPressed: _busy != null || !hasKey
                          ? null
                          : () => _extract(u["id"].toString()),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: _activeId == u["id"] ? Palette.signal : Palette.dim,
                        side: BorderSide(
                          color: _activeId == u["id"] ? Palette.signal : Palette.lineBright,
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        minimumSize: Size.zero,
                      ),
                      child: Text(
                        _busy == "extracting" && _activeId == u["id"] ? "reading…" : "extract",
                        style: const TextStyle(fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
          ],

          if (_delta != null) ...<Widget>[
            const SizedBox(height: 34),
            const Divider(height: 1, color: Palette.line),
            const SizedBox(height: 24),
            const MonoLabel("diff against the live corpus", color: Palette.signal),
            const SizedBox(height: 10),
            Text(
              _delta!["summary"].toString(),
              style: const TextStyle(color: Palette.ink, fontSize: 14.5, height: 1.5),
            ),

            const SizedBox(height: 22),
            MonoLabel("newly learned (${learned.length})", color: Palette.signal),
            const SizedBox(height: 8),
            if (learned.isEmpty)
              Text("nothing the site didn't know", style: monoStyle.copyWith(fontSize: 11))
            else
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: <Widget>[
                  for (final String l in learned) Pill(l, color: Palette.signal),
                ],
              ),

            if (added.isNotEmpty) ...<Widget>[
              const SizedBox(height: 20),
              MonoLabel("added (${added.length})"),
              const SizedBox(height: 6),
              for (final String a in added)
                Padding(
                  padding: const EdgeInsets.only(bottom: 3),
                  child: Text("+ $a",
                      style: const TextStyle(color: Palette.dim, fontSize: 13)),
                ),
            ],

            if (changed.isNotEmpty) ...<Widget>[
              const SizedBox(height: 20),
              MonoLabel("changed (${changed.length})"),
              const SizedBox(height: 6),
              for (final String c in changed)
                Padding(
                  padding: const EdgeInsets.only(bottom: 3),
                  child: Text("~ $c",
                      style: const TextStyle(color: Palette.dim, fontSize: 13)),
                ),
            ],

            const SizedBox(height: 28),
            const MonoLabel("apply which sections"),
            const SizedBox(height: 6),
            for (final List<String> s in _sections)
              CheckboxListTile(
                value: _selected.contains(s[0]),
                onChanged: (bool? v) => setState(() {
                  if (v == true) {
                    _selected.add(s[0]);
                  } else {
                    _selected.remove(s[0]);
                  }
                }),
                dense: true,
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                activeColor: Palette.signal,
                checkColor: Palette.bg,
                title: Text(s[1],
                    style: const TextStyle(color: Palette.ink, fontSize: 14)),
                subtitle: Text(s[2], style: monoStyle.copyWith(fontSize: 10.5, height: 1.5)),
              ),

            const SizedBox(height: 18),
            FilledButton(
              onPressed: _busy != null || _selected.isEmpty ? null : _apply,
              child: Text(
                _busy == "applying"
                    ? "Writing…"
                    : "Write ${_selected.length} sections",
              ),
            ),
            const SizedBox(height: 14),
            Text(
              "Trade-offs and what-went-wrong are never touched — a résumé "
              "does not contain them, and they are the sections an interviewer "
              "actually stops on. Fill those in under Projects.",
              style: monoStyle.copyWith(fontSize: 10.5, height: 1.7),
            ),
          ],
        ],
      ),
    );
  }
}
