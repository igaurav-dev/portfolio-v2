import "package:flutter/material.dart";

import "../theme.dart";

/// Renders one field from the schema served by /api/admin/schema, so the
/// phone and the website build identical forms from a single definition.
class FieldInput extends StatelessWidget {
  const FieldInput({
    super.key,
    required this.field,
    required this.value,
    required this.onChanged,
  });

  final Map<String, dynamic> field;
  final dynamic value;
  final ValueChanged<dynamic> onChanged;

  String get _type => (field["type"] ?? "text").toString();
  String get _label => (field["label"] ?? field["key"]).toString();
  String? get _hint => field["hint"]?.toString();
  bool get _required => field["required"] == true;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              MonoLabel(_label),
              if (_required)
                const Padding(
                  padding: EdgeInsets.only(left: 4),
                  child: Text("*", style: TextStyle(color: Palette.signal, fontSize: 12)),
                ),
            ],
          ),
          if (_hint != null) ...<Widget>[
            const SizedBox(height: 4),
            Text(
              _hint!,
              style: const TextStyle(color: Palette.faint, fontSize: 11.5, height: 1.45),
            ),
          ],
          const SizedBox(height: 7),
          _build(context),
        ],
      ),
    );
  }

  Widget _build(BuildContext context) {
    switch (_type) {
      case "textarea":
        return _TextField(
          value: value?.toString() ?? "",
          maxLines: (field["rows"] as num?)?.toInt() ?? 4,
          onChanged: onChanged,
        );

      case "select":
        final List<String> options = <String>[
          for (final dynamic o in (field["options"] as List<dynamic>? ?? <dynamic>[]))
            o.toString(),
        ];
        final String current = value?.toString() ?? "";
        return DropdownButtonFormField<String>(
          value: options.contains(current) ? current : null,
          dropdownColor: Palette.panel,
          style: const TextStyle(color: Palette.ink, fontSize: 14),
          items: <DropdownMenuItem<String>>[
            for (final String o in options)
              DropdownMenuItem<String>(value: o, child: Text(o)),
          ],
          onChanged: (String? v) => onChanged(v ?? ""),
        );

      case "tags":
        return _TagsField(
          values: <String>[
            for (final dynamic v in (value as List<dynamic>? ?? <dynamic>[])) v.toString(),
          ],
          onChanged: onChanged,
        );

      case "lines":
        final List<String> lines = <String>[
          for (final dynamic v in (value as List<dynamic>? ?? <dynamic>[])) v.toString(),
        ];
        return _TextField(
          value: lines.join("\n"),
          maxLines: (field["rows"] as num?)?.toInt() ?? 5,
          hint: "one per line",
          onChanged: (String text) => onChanged(
            text.split("\n").where((String l) => l.trim().isNotEmpty).toList(),
          ),
        );

      case "objects":
        return _ObjectListField(
          rows: <Map<String, dynamic>>[
            for (final dynamic r in (value as List<dynamic>? ?? <dynamic>[]))
              Map<String, dynamic>.from(r as Map<dynamic, dynamic>),
          ],
          fields: <Map<String, dynamic>>[
            for (final dynamic f in (field["fields"] as List<dynamic>? ?? <dynamic>[]))
              Map<String, dynamic>.from(f as Map<dynamic, dynamic>),
          ],
          onChanged: onChanged,
        );

      default:
        return _TextField(
          value: value?.toString() ?? "",
          hint: field["placeholder"]?.toString(),
          onChanged: onChanged,
        );
    }
  }
}

/// A TextField that keeps its own controller so the cursor does not jump
/// when the parent rebuilds.
class _TextField extends StatefulWidget {
  const _TextField({
    required this.value,
    required this.onChanged,
    this.maxLines = 1,
    this.hint,
  });

  final String value;
  final ValueChanged<String> onChanged;
  final int maxLines;
  final String? hint;

  @override
  State<_TextField> createState() => _TextFieldState();
}

class _TextFieldState extends State<_TextField> {
  late final TextEditingController _controller =
      TextEditingController(text: widget.value);

  @override
  void didUpdateWidget(_TextField old) {
    super.didUpdateWidget(old);
    // Only adopt an external change if the user is not mid-edit.
    if (widget.value != _controller.text && !_focus.hasFocus) {
      _controller.text = widget.value;
    }
  }

  final FocusNode _focus = FocusNode();

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      focusNode: _focus,
      maxLines: widget.maxLines,
      minLines: widget.maxLines > 1 ? widget.maxLines : null,
      onChanged: widget.onChanged,
      style: const TextStyle(color: Palette.ink, fontSize: 14, height: 1.45),
      decoration: InputDecoration(hintText: widget.hint),
    );
  }
}

class _TagsField extends StatefulWidget {
  const _TagsField({required this.values, required this.onChanged});

  final List<String> values;
  final ValueChanged<List<String>> onChanged;

  @override
  State<_TagsField> createState() => _TagsFieldState();
}

class _TagsFieldState extends State<_TagsField> {
  final TextEditingController _draft = TextEditingController();

  @override
  void dispose() {
    _draft.dispose();
    super.dispose();
  }

  void _commit() {
    final List<String> parts = _draft.text
        .split(",")
        .map((String p) => p.trim())
        .where((String p) => p.isNotEmpty && !widget.values.contains(p))
        .toList();
    if (parts.isNotEmpty) {
      widget.onChanged(<String>[...widget.values, ...parts]);
    }
    _draft.clear();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        if (widget.values.isEmpty)
          Text("none yet", style: monoStyle.copyWith(fontSize: 11))
        else
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: <Widget>[
              for (final String tag in widget.values)
                Pill(
                  tag,
                  onTap: () => widget.onChanged(
                    widget.values.where((String t) => t != tag).toList(),
                  ),
                ),
            ],
          ),
        const SizedBox(height: 8),
        TextField(
          controller: _draft,
          onSubmitted: (_) => _commit(),
          textInputAction: TextInputAction.done,
          style: const TextStyle(color: Palette.ink, fontSize: 14),
          decoration: InputDecoration(
            hintText: "add — commas split",
            suffixIcon: IconButton(
              icon: const Icon(Icons.add, size: 19, color: Palette.signal),
              onPressed: _commit,
            ),
          ),
        ),
      ],
    );
  }
}

class _ObjectListField extends StatelessWidget {
  const _ObjectListField({
    required this.rows,
    required this.fields,
    required this.onChanged,
  });

  final List<Map<String, dynamic>> rows;
  final List<Map<String, dynamic>> fields;
  final ValueChanged<List<Map<String, dynamic>>> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        for (int i = 0; i < rows.length; i++)
          Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Palette.raised,
              border: Border.all(color: Palette.line),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Text(
                      (i + 1).toString().padLeft(2, "0"),
                      style: monoStyle.copyWith(fontSize: 10.5),
                    ),
                    const Spacer(),
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(Icons.arrow_upward, size: 17, color: Palette.faint),
                      onPressed: i == 0 ? null : () => _move(i, -1),
                    ),
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(Icons.arrow_downward, size: 17, color: Palette.faint),
                      onPressed: i == rows.length - 1 ? null : () => _move(i, 1),
                    ),
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(Icons.close, size: 17, color: Palette.dead),
                      onPressed: () => onChanged(
                        <Map<String, dynamic>>[
                          for (int j = 0; j < rows.length; j++)
                            if (j != i) rows[j],
                        ],
                      ),
                    ),
                  ],
                ),
                for (final Map<String, dynamic> f in fields)
                  FieldInput(
                    field: f,
                    value: rows[i][f["key"].toString()],
                    onChanged: (dynamic v) {
                      final List<Map<String, dynamic>> next =
                          <Map<String, dynamic>>[...rows];
                      next[i] = <String, dynamic>{
                        ...next[i],
                        f["key"].toString(): v,
                      };
                      onChanged(next);
                    },
                  ),
              ],
            ),
          ),
        OutlinedButton.icon(
          onPressed: () => onChanged(<Map<String, dynamic>>[
            ...rows,
            <String, dynamic>{
              for (final Map<String, dynamic> f in fields) f["key"].toString(): "",
            },
          ]),
          icon: const Icon(Icons.add, size: 17),
          label: const Text("add"),
        ),
      ],
    );
  }

  void _move(int index, int direction) {
    final int target = index + direction;
    if (target < 0 || target >= rows.length) return;
    final List<Map<String, dynamic>> next = <Map<String, dynamic>>[...rows];
    final Map<String, dynamic> tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    onChanged(next);
  }
}
