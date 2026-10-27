package com.afkbot.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

/** Uygulama arka plana gecince Android'in botu oldurmesini engelleyen on plan servisi. */
public class KeepAliveService extends Service {

    private static final String KANAL_ID = "afk_bot_servis";
    private static final int BILDIRIM_ID = 4711;
    private PowerManager.WakeLock wakeLock;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
            NotificationChannel kanal = new NotificationChannel(KANAL_ID, "AFK Bot", NotificationManager.IMPORTANCE_LOW);
            kanal.setDescription("Bot calisirken gorunen bildirim");
            nm.createNotificationChannel(kanal);
        }

        Intent ac = new Intent(this, MainActivity.class);
        ac.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, ac, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Notification bildirim = new NotificationCompat.Builder(this, KANAL_ID)
                .setContentTitle("AFK Bot calisiyor")
                .setContentText("Baglantiyi acik tutmak icin bu bildirimi kapatma")
                .setSmallIcon(android.R.drawable.stat_notify_sync)
                .setContentIntent(pi)
                .setOngoing(true)
                .build();

        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(BILDIRIM_ID, bildirim, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(BILDIRIM_ID, bildirim);
        }

        if (wakeLock == null) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "afkbot:baglanti");
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire();
            }
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
