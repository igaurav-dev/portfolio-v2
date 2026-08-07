import 'package:flutter/material.dart';

/// Same instrument-panel palette as the website, so the two do not feel
/// like different products.
class Palette {
  static const bg = Color(0xFF0A0A0B);
  static const panel = Color(0xFF101012);
  static const raised = Color(0xFF16161A);
  static const line = Color(0xFF1E1E23);
  static const lineBright = Color(0xFF2C2C33);
  static const ink = Color(0xFFE8E8EA);
  static const dim = Color(0xFF9A9AA3);
  static const faint = Color(0xFF61616B);
  static const signal = Color(0xFFD8FF3E);
  static const dead = Color(0xFFFF6B57);
}

ThemeData buildTheme() {
  const base = ColorScheme.dark(
    primary: Palette.signal,
    onPrimary: Palette.bg,
    secondary: Palette.signal,
    surface: Palette.panel,
    onSurface: Palette.ink,
    error: Palette.dead,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: base,
    scaffoldBackgroundColor: Palette.bg,
    canvasColor: Palette.bg,
    dividerColor: Palette.line,
    fontFamily: null,
    appBarTheme: const AppBarTheme(
      backgroundColor: Palette.bg,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      foregroundColor: Palette.ink,
      titleTextStyle: TextStyle(
        color: Palette.ink,
        fontSize: 17,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.3,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Palette.panel,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: const BorderSide(color: Palette.lineBright),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: const BorderSide(color: Palette.lineBright),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: const BorderSide(color: Palette.signal, width: 1.4),
      ),
      labelStyle: const TextStyle(color: Palette.faint, fontSize: 13),
      hintStyle: const TextStyle(color: Palette.faint, fontSize: 13),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: Palette.signal),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: Palette.signal,
        foregroundColor: Palette.bg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: Palette.dim,
        side: const BorderSide(color: Palette.lineBright),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
      ),
    ),
    listTileTheme: const ListTileThemeData(
      textColor: Palette.ink,
      iconColor: Palette.faint,
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: Palette.raised,
      contentTextStyle: TextStyle(color: Palette.ink, fontSize: 13),
      behavior: SnackBarBehavior.floating,
    ),
  );
}

/// Monospace stack that resolves on both platforms without shipping a font.
const List<String> monoFallback = <String>[
  "Menlo",
  "SF Mono",
  "Roboto Mono",
  "monospace",
];

const TextStyle monoStyle = TextStyle(
  fontFamilyFallback: monoFallback,
  fontSize: 11,
  letterSpacing: 0.8,
  color: Palette.faint,
);

/// Small uppercase label used everywhere on the site.
class MonoLabel extends StatelessWidget {
  const MonoLabel(this.text, {super.key, this.color, this.size = 11});

  final String text;
  final Color? color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: monoStyle.copyWith(color: color ?? Palette.faint, fontSize: size),
    );
  }
}

/// A thin bordered chip, the app's equivalent of the site's <Tag>.
class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, this.color, this.onTap});

  final String text;
  final Color? color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = color ?? Palette.dim;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: BoxDecoration(
          border: Border.all(color: Palette.lineBright),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              text,
              style: monoStyle.copyWith(color: c, fontSize: 10.5),
            ),
            if (onTap != null) ...<Widget>[
              const SizedBox(width: 5),
              const Text("x", style: TextStyle(color: Palette.faint, fontSize: 11)),
            ],
          ],
        ),
      ),
    );
  }
}
