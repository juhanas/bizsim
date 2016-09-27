function setOrders() {
    var url = "/setOrders";
    var method = "POST";
    var postData = {
        "token": $("#id_token").val(),
        "gameId": parseInt($("#id_gameId").text()),
        "companyId": parseInt($("#id_companyId").text()),
        "propertyId": parseInt($("#id_propertyId").text()),
        "production": parseInt($("#id_productionOrder").val()),
        "capacityChange": parseInt($("#id_capacityChangeOrder").val()),
        "storageChange": parseInt($("#id_storageChangeOrder").val()),
        "price": parseInt($("#id_priceOrder").val()),
    }
    var async = true;

    var request = new XMLHttpRequest();

    request.onload = function () {
        if(request.status == '200') { 
            var json = JSON.parse(request.responseText); // TODO: Throws error if not JSON
            var message = '';
            if(json.hasOwnProperty('errorMessage')){
                $("#orderMessage").html('Error: ' + json['errorMessage']);
                return;
            }
            if(json.hasOwnProperty('money')){
                var money = parseInt(json['money']).toLocaleString('en');
                $("#id_money>.value").html(money);
                message += 'Money changed to: $' + money + '\<br/\>';
            }
            if(json.hasOwnProperty('production')){
                $("#id_production>.value").html(json['production']);
                $("#id_productionOrder").val(json['production']);
                message += 'Production changed to: ' + json['production'] + ' products/week\<br/\>';
            }
            if(json.hasOwnProperty('capacity')){
                $("#id_capacity>.value").html(json['capacity']);
                $("#id_capacityChangeOrder").val(0);
                message += 'Capacity changed to: ' + json['capacity'] + ' products/week\<br/\>';
            }
            if(json.hasOwnProperty('storage')){
                $("#id_storageSize>.value").html(json['storage']);
                $("#id_storageChangeOrder").val(0);
                message += 'Warehouse size changed to: ' + json['storage'] + ' products\<br/\>';
            }
            if(json.hasOwnProperty('price')){
                $("#id_price>.value").html(json['price']);
                message += 'Price changed to: $' + json['price'] + ' / product\<br/\>';
            }
            $("#orderMessage").html(message);
        } else {
            alert("Error setting orders:\n" + json);
        }
    }
    request.open(method, url, async);
    
    var token = Cookies.get('csrftoken');
    request.setRequestHeader('Content-type', 'application/json');
    request.setRequestHeader('X-CSRFToken', token);

    request.send(JSON.stringify(postData));
}
/*
function updateOrders() {
    $("#id_production").val(),
    "capacityChange": $("#id_capacityChange").val(),
    "storageChange": $("#id_storageChange").val(),
    "price": $("#id_price").val(),
    var async = true;
            $("#id_Money").html(json['money']);
            $("#id_Production").html(json['production']);
            $("#id_CapacityProduction").html(json['capacity']);
            $("#id_WarehouseSize").html(json['storage']);
            $("#id_Price").html(json['price']);
}*/


function createCompany() {
    var url = "/createCompany";
    var method = "POST";
    var postData = {
        "gameName": $("#id_gameName").val(),
        "gameId": $("#id_gameId").val(),
        "areaId": $("#id_areaId").val(),
        "companyName": $("#id_createCompanyName").val(),
    }
    var async = true;

    var request = new XMLHttpRequest();

    request.onload = function () {
        if(request.status == '200') { 
            var json = JSON.parse(request.responseText); // TODO: Throws error if not JSON
            var message = '';
            if(json.hasOwnProperty('errorMessage')){
                $("#createCompanyMessage").html('Error: ' + json['errorMessage']);
                return;
            }
            $("#createCompanyMessage").html(message);
        } else {
            alert("Error creating a company:\n" + request.responseText);
        }
    }
    request.open(method, url, async);
    
    var token = Cookies.get('csrftoken');
    request.setRequestHeader('Content-type', 'application/json');
    request.setRequestHeader('X-CSRFToken', token);

    request.send(JSON.stringify(postData));
}
