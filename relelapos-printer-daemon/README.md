# RELELAPOS Realtime POS Printing Daemon

Diamond-Precision, API-driven thermal printing daemon for **RELELAPOS**.  
Automatically prints customer retail receipts and kitchen token slips (KOT) as soon as an order is placed from the customer store or Admin POS.

---

## 💎 Diamond Precision Guarantee
- **Zero Missed Orders**: Orders are held in an atomic queue with 60-second lease locks. If a laptop loses Wi-Fi or restarts mid-print, the server safely recovers and re-offers the job.
- **Zero Double-Printing**: Orders are permanently recorded in `printedOrderIds` on the server and verified against `daemon_printed_cache.json` locally before sending bytes to the printer.
- **Multi-Device Support**: Run on one laptop or multiple laptops (e.g. Counter Billing Laptop + Kitchen Display Laptop). Atomic leasing ensures only one laptop prints each order.
- **Zero External Dependencies**: Built with native Node.js and Windows PowerShell. No `npm install` needed.

---

## 🚀 Quick Start

### Option 1: Running on the Same Laptop as the POS Server
1. Double-click `run_printer_daemon.cmd`.
2. The daemon will start polling `http://localhost:3000` and print new orders instantly to your Windows default printer.

### Option 2: Running on Another Laptop (Over Wi-Fi / LAN)
1. Copy the entire `relelapos-printer-daemon` folder to the second laptop (via USB or network share).
2. On the **Main Server Laptop**, find your local IP address:
   - Open Command Prompt and type: `ipconfig`
   - Look for **IPv4 Address** (e.g. `192.168.1.15`).
3. On the **Second Laptop**, open `config.json` and update `serverUrl`:
   ```json
   {
     "serverUrl": "http://192.168.1.15:3000",
     "deviceId": "laptop-cashier-02"
   }
   ```
4. Double-click `run_printer_daemon.cmd`!

---

## ⚙️ Configuration Reference (`config.json`)

| Setting | Default | Description |
|---|---|---|
| `serverUrl` | `http://localhost:3000` | POS Server URL. Change to LAN IP when running on another laptop. |
| `deviceId` | `laptop-pos-counter` | Unique identifier for this laptop/station. |
| `pollIntervalMs` | `1500` | Polling frequency in milliseconds (1.5 seconds). |
| `printerMode` | `"windows"` | `"windows"` (PowerShell spooler), `"raw_escpos"` (Network thermal printer), `"file_spool"` (Save `.txt`), or `"both"`. |
| `windowsPrinterName` | `""` | Name of your thermal printer in Windows Printers. Leave blank `""` to use your default printer. |
| `networkPrinter` | `{ "host": "192.168.1.200", "port": 9100 }` | Host IP and port for network ESC/POS thermal printers. |
| `printCustomerBill` | `true` | Prints the Customer Retail Bill (41 columns, matching reference photo). |
| `printKotSlip` | `true` | Prints the Kitchen Token (KOT) slip. |
| `saveReceiptCopies`| `true` | Saves a timestamped `.txt` copy in `receipts_history/` for audit trail. |

---

## 🖨️ How to Set Your Thermal Printer

1. Open **Windows Settings** > **Bluetooth & devices** > **Printers & scanners**.
2. Find your thermal printer name (e.g. `POS-80`, `EPSON TM-T20`, `Everycom-58`).
3. You can either:
   - Set it as your **Default Printer** in Windows (leave `windowsPrinterName: ""` in `config.json`).
   - OR specify the exact name in `config.json`:
     ```json
     "windowsPrinterName": "POS-80"
     ```
4. Test your printer anytime by running `test_print.cmd`.

---

## 🧪 Testing
- **Test Printer**: Double-click `test_print.cmd` to print a sample reference receipt and KOT slip.
- **Audit Logs**: All printed receipts are archived with timestamps in the `receipts_history/` folder.
