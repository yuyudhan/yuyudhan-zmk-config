# FilePath: config/boards/shields/corne/CMakeLists.txt

# ═══════════════════════════════════════════════════════════════════
# FILE: config/boards/shields/corne/CMakeLists.txt
# ROLE: CMake build rules for the custom right-half display.
#
# Only compiled when CONFIG_CORNE_CUSTOM_DISPLAY=y, which is set in
# corne_right.conf. The entire block is a no-op for left-half builds,
# keeping that binary smaller. Compiles src/custom_status_screen.c into a
# named Zephyr library that satisfies the zmk_display_status_screen() symbol
# required when ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y.
# ═══════════════════════════════════════════════════════════════════

if(CONFIG_CORNE_CUSTOM_DISPLAY)

  # Create a named Zephyr library for all custom display source files.
  # Zephyr's build system tracks "zephyr libraries" as discrete CMake
  # static libraries that are linked into the final firmware image.
  # Giving it a name ("corne_custom_display") makes it easy to identify
  # in build logs and CMake dependency graphs.
  zephyr_library_named(corne_custom_display)

  # Add the ZMK top-level include directory to this library's include path.
  # ${CMAKE_SOURCE_DIR} resolves to the ZMK app/ root during a west build,
  # so this makes ZMK's public headers (e.g., zmk/display.h, zmk/events/*.h)
  # available to any .c files compiled as part of this library — without
  # needing to hard-code an absolute path.
  zephyr_library_include_directories(${CMAKE_SOURCE_DIR}/include)

  # Add the custom status screen implementation to the library's source list.
  # src/custom_status_screen.c is the C file that defines the LVGL layout,
  # widgets, and event subscriptions for the right half's display.
  # It is only compiled when CONFIG_CORNE_CUSTOM_DISPLAY=y (see above).
  zephyr_library_sources(src/custom_status_screen.c)

  # Bake the selected keymap variant into the central display as a short label.
  # KEYMAP_VARIANT is passed by build.sh (e.g. "yuyudhan-2"); take its trailing
  # digits and prefix "Y" -> "Y2". Fall back to "YX" if unknown / no digits.
  if(NOT DEFINED KEYMAP_VARIANT)
    set(KEYMAP_VARIANT "unknown")
  endif()
  string(REGEX MATCH "[0-9]+$" _km_num "${KEYMAP_VARIANT}")
  if(_km_num STREQUAL "")
    set(_km_label "YX")
  else()
    set(_km_label "Y${_km_num}")
  endif()
  message(STATUS "Keymap variant label: ${_km_label}")
  zephyr_library_compile_definitions(KEYMAP_VARIANT_LABEL=${_km_label})

endif()

# Display-blanking toggle behavior: compiled on every half that has a display.
# Both corne_left and corne_right set CONFIG_ZMK_DISPLAY=y, so this compiles
# on both sides.  Each half toggles its own DEVICE_DT_GET(DT_CHOSEN(zephyr_display)).
if(CONFIG_ZMK_DISPLAY)
  zephyr_library_named(corne_behavior_display_toggle)
  zephyr_library_include_directories(${CMAKE_SOURCE_DIR}/include)
  zephyr_library_sources(src/behavior_display_toggle.c)
endif()
