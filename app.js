// تطبيق JavaScript الرئيسي
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyUJWbPISNtdWEkvghpkNF68nWeozDZ0eY0_dU8TzpjT3sY8gsvAbEyXROvan6kTzeG/exec'; // استبدل برابط النشر

let cameraActive = false;

// تبديل التبويبات
function switchTab(tabName) {
    // إخفاء جميع المحتويات
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // إلغاء تنشيط جميع الأزرار
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // إظهار المحتوى المحدد
    document.getElementById(tabName + '-tab').classList.add('active');
    
    // تنشيط الزر المحدد
    event.target.classList.add('active');
    
    // إيقاف الكاميرا إذا كانت نشطة
    if (cameraActive) {
        stopCamera();
    }
}

// تشغيل الكاميرا
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        
        const video = document.getElementById('video');
        video.srcObject = stream;
        cameraActive = true;
        
        // بدء مسح الباركود بعد تحميل الفيديو
        video.onloadedmetadata = () => {
            initBarcodeScanner();
        };
        
    } catch (error) {
        alert('خطأ في تشغيل الكاميرا: ' + error.message);
    }
}

// إيقاف الكاميرا
function stopCamera() {
    const video = document.getElementById('video');
    const stream = video.srcObject;
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
    
    cameraActive = false;
    
    // إيقاف مسح الباركود
    if (window.quaggaInitialized) {
        Quagga.stop();
        window.quaggaInitialized = false;
    }
    
    document.getElementById('barcode-result').style.display = 'none';
}

// تهيئة ماسح الباركود
function initBarcodeScanner() {
    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.getElementById('video'),
            constraints: {
                width: 640,
                height: 480,
                facingMode: "environment"
            }
        },
        decoder: {
            readers: [
                "code_128_reader",
                "ean_reader",
                "ean_8_reader",
                "code_39_reader",
                "upc_reader"
            ]
        }
    }, function(err) {
        if (err) {
            console.error('خطأ في تهيئة Quagga:', err);
            return;
        }
        
        Quagga.start();
        window.quaggaInitialized = true;
    });

    Quagga.onDetected(function(result) {
        const code = result.codeResult.code;
        document.getElementById('barcode-value').textContent = code;
        document.getElementById('camera-meter-number').value = code;
        document.getElementById('barcode-result').style.display = 'block';
        
        // إيقاف المسح مؤقتاً لثواني
        Quagga.stop();
        setTimeout(() => {
            if (cameraActive) Quagga.start();
        }, 3000);
    });
}

// إرسال البيانات إلى Google Sheets
async function submitData(inputMethod) {
    const meterNumber = document.getElementById(inputMethod + '-meter-number').value;
    const notes = document.getElementById(inputMethod + '-notes').value;
    
    if (!meterNumber) {
        showResult('يرجى إدخال رقم العداد', 'error');
        return;
    }
    
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                meterNumber: meterNumber,
                notes: notes,
                inputMethod: inputMethod === 'camera' ? 'مسح الباركود' : 'إدخال يدوي'
            })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showResult('✅ تم حفظ البيانات بنجاح في Google Sheets', 'success');
            // مسح الحقول
            document.getElementById(inputMethod + '-meter-number').value = '';
            document.getElementById(inputMethod + '-notes').value = '';
            document.getElementById('barcode-result').style.display = 'none';
        } else {
            showResult('❌ خطأ في حفظ البيانات', 'error');
        }
        
    } catch (error) {
        showResult('❌ خطأ في الاتصال: ' + error.message, 'error');
    }
}

// عرض رسائل النتيجة
function showResult(message, type) {
    const resultDiv = document.getElementById('result-message');
    resultDiv.innerHTML = `<div class="result ${type}">${message}</div>`;
    
    setTimeout(() => {
        resultDiv.innerHTML = '';
    }, 5000);
}
