package com.afkbot.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Arayuzden (JavaScript) cagrilir: on plan servisini baslatir/durdurur ve pil kisitlamasi izni ister. */
@CapacitorPlugin(name = "KeepAlive")
public class KeepAlivePlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), KeepAliveService.class);
            ContextCompat.startForegroundService(getContext(), intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Servis baslatilamadi: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            getContext().stopService(new Intent(getContext(), KeepAliveService.class));
            call.resolve();
        } catch (Exception e) {
            call.reject("Servis durdurulamadi: " + e.getMessage());
        }
    }

    @PluginMethod
    public void pilIzni(PluginCall call) {
        Context ctx = getContext();
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        String paket = ctx.getPackageName();
        boolean izinli = pm != null && pm.isIgnoringBatteryOptimizations(paket);
        if (!izinli) {
            try {
                Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + paket));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
            } catch (Exception e) {
                // bazi telefonlarda bu ekran yoktur; kullanici Ayarlar'dan elle kapatir
            }
        }
        JSObject sonuc = new JSObject();
        sonuc.put("izinli", izinli);
        call.resolve(sonuc);
    }
}
