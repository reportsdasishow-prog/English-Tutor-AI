# LingoLive AI - Изучение языков с ИИ

Это приложение для практики разговорного английского языка с использованием Gemini Live API.

## Запуск на GNU/Linux (Debian/Ubuntu)

1. Убедитесь, что у вас установлен Node.js:
   ```bash
   sudo apt update
   sudo apt install nodejs npm
   ```

2. Сделайте скрипт запуска исполняемым:
   ```bash
   chmod +x launch.sh
   ```

3. Запустите приложение:
   ```bash
   ./launch.sh
   ```

4. Откройте в браузере адрес, который появится в терминале (обычно `http://localhost:5173`).

## Интеграция в систему
Чтобы запускать приложение из главного меню:
```bash
mkdir -p ~/.local/share/applications
cp lingolive.desktop ~/.local/share/applications/
```
