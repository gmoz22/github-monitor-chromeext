
function saveSettingsForm() {
//    console.log('id: ' + id);
    var clientID        = document.getElementById('clientID').value;
    var clientSecret    = document.getElementById('clientSecret').value;
    console.log('clientID: ' + clientID);
    console.log('clientSecret: ' + clientSecret);

    chrome.storage.sync.set({'clientID': clientID, 'clientSecret': clientSecret}, function() {
        // Notify that we saved.
        message('Settings saved');
    });
/*
    document.forms[i].addEventListener("submit", function(){
    var form = this.form;
    var data = [form.elements["user"], form.elements["password"]];
    // contact with your background page and send the form data.
    chrome.extension.sendRequest({'name':'form_submit', 'data':data}, function(){ *//* my callback if needed *//* }, false);
    */
}

document.getElementById('formSettings').addEventListener("submit", function(){
   chrome.message('form submitted');

});