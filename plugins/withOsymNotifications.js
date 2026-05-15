const { withAndroidManifest } = require('@expo/config-plugins');

const PERMISSIONS = [
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.USE_EXACT_ALARM',
  'android.permission.VIBRATE',
];

/**
 * Ensures Android manifest permissions for Kotlin AlarmManager scheduling.
 * Receivers are declared in the local Expo module manifest (merged at build time).
 */
function withOsymNotifications(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const existing = new Set(
      manifest['uses-permission']
        .map((entry) => entry?.$?.['android:name'])
        .filter(Boolean),
    );

    for (const permission of PERMISSIONS) {
      if (!existing.has(permission)) {
        manifest['uses-permission'].push({
          $: { 'android:name': permission },
        });
      }
    }

    return config;
  });
}

module.exports = withOsymNotifications;
