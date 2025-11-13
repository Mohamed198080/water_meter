// app.js
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('meterForm');
    const scanBarcodeBtn = document.getElementById('scanBarcode');
    const getLocationBtn = document.getElementById('getLocation');
    const barcodeModal = new bootstrap.Modal(document.getElementById('barcodeModal'));
    const cameraPreview = document.getElementById('cameraPreview');
    
    // مسح الباركود
    scanBarcodeBtn.addEventListener('click', function() {
        barcodeModal.show();
        startBarcodeScanner();
    });
    
    // الحصول على الموقع
    getLocationBtn.addEventListener('click', function() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    document.getElementById('latitude').value = position.coords.latitude;
                    document.getElementById('longitude').value = position.coords.longitude;
                },
                function(error) {
                    alert('فشل في الحصول على الموقع: ' + error.message);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0
                }
            );
        } else {
            alert('المتصفح لا يدعم الحصول على الموقع');
        }
    });
    
    // إرسال النموذج
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        submitForm();
    });
    
    // بدء مسح الباركود
    function startBarcodeScanner() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            cameraPreview.innerHTML = '<span class="text-danger">الكاميرا غير مدعومة في هذا المتصفح</span>';
            return;
        }
        
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
            .then(function(stream) {
                cameraPreview.innerHTML = '';
                const video = document.createElement('video');
                video.setAttribute('autoplay', '');
                video.setAttribute('playsinline', '');
                video.srcObject = stream;
                cameraPreview.appendChild(video);
                
                // تهيئة Quagga.js لقراءة الباركود
                Quagga.init({
                    inputStream: {
                        name: "Live",
                        type: "LiveStream",
                        target: video,
                        constraints: {
                            facingMode: "environment"
                        }
                    },
                    decoder: {
                        readers: ["code_128_reader", "ean_reader", "ean_8_reader", "code_39_reader"]
                    }
                }, function(err) {
                    if (err) {
                        console.error(err);
                        cameraPreview.innerHTML = '<span class="text-danger">فشل في تهيئة قارئ الباركود</span>';
                        return;
                    }
                    Quagga.start();
                });
                
                Quagga.onDetected(function(result) {
                    const code = result.codeResult.code;
                    document.getElementById('meterNumber').value = code;
                    Quagga.stop();
                    stream.getTracks().forEach(track => track.stop());
                    barcodeModal.hide();
                });
            })
            .catch(function(err) {
                console.error(err);
                cameraPreview.innerHTML = '<span class="text-danger">فشل في الوصول إلى الكاميرا</span>';
            });
    }
    
    // إرسال البيانات
    async function submitForm() {
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري الحفظ...';
        
        try {
            // رفع الصور أولاً
            const imageUrls = await uploadImages();
            
            // جمع البيانات
            const formData = {
                meterNumber: document.getElementById('meterNumber').value,
                meterType: document.getElementById('meterType').value,
                meterBrand: document.getElementById('meterBrand').value,
                valveType: document.getElementById('valveType').value,
                valveCondition: document.getElementById('valveCondition').value,
                boxCondition: document.getElementById('boxCondition').value,
                pieceNumber: document.getElementById('pieceNumber').value,
                propertyType: document.getElementById('propertyType').value,
                propertyCondition: document.getElementById('propertyCondition').value,
                hasViolation: document.getElementById('hasViolation').value,
                districtName: document.getElementById('districtName').value,
                electricMetersCount: document.getElementById('electricMetersCount').value,
                latitude: document.getElementById('latitude').value,
                longitude: document.getElementById('longitude').value,
                technicianName: document.getElementById('technicianName').value,
                ...imageUrls
            };
            
            // إرسال البيانات إلى Google Sheets
            const response = await saveToGoogleSheets(formData);
            
            if (response.success) {
                alert('تم حفظ البيانات بنجاح!');
                form.reset();
            } else {
                throw new Error(response.message || 'فشل في حفظ البيانات');
            }
        } catch (error) {
            console.error(error);
            alert('حدث خطأ أثناء حفظ البيانات: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'حفظ البيانات';
        }
    }
    
    // رفع الصور إلى ImgBB
    async function uploadImages() {
        const imageFields = [
            'meterImage', 'pieceNumberImage', 'propertyImage', 
            'electricMetersImage', 'valveImage', 'boxImage', 'violationImage'
        ];
        
        const imageUrls = {};
        const apiKey = '943880b0a24534cdb564d3ad6ea8f3a8';
        
        for (const field of imageFields) {
            const fileInput = document.getElementById(field);
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const formData = new FormData();
                formData.append('image', file);
                
                try {
                    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
                        method: 'POST',
                        body: formData
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        // تعيين اسم الحقل المناسب بناءً على نوع الصورة
                        let fieldName;
                        switch(field) {
                            case 'meterImage': fieldName = 'meterImageUrl'; break;
                            case 'pieceNumberImage': fieldName = 'pieceNumberImageUrl'; break;
                            case 'propertyImage': fieldName = 'propertyImageUrl'; break;
                            case 'electricMetersImage': fieldName = 'electricMetersImageUrl'; break;
                            case 'valveImage': fieldName = 'valveImageUrl'; break;
                            case 'boxImage': fieldName = 'boxImageUrl'; break;
                            case 'violationImage': fieldName = 'violationImageUrl'; break;
                        }
                        
                        imageUrls[fieldName] = result.data.url;
                    } else {
                        console.error(`فشل في رفع ${field}:`, result.error);
                    }
                } catch (error) {
                    console.error(`خطأ في رفع ${field}:`, error);
                }
            }
        }
        
        return imageUrls;
    }
    
    // حفظ البيانات في Google Sheets
    async function saveToGoogleSheets(data) {
        // استبدل هذا الرابط برابط Google Apps Script الخاص بك
        const scriptUrl = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
        
        try {
            const response = await fetch(scriptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            return await response.json();
        } catch (error) {
            throw new Error('فشل في الاتصال بخادم البيانات');
        }
    }
});
