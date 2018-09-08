function right_button(index,number,symbol){
    /* jquery call to get data and post to /save route  */
    data = {'symbol': $("#model_symbol").text(),
	    'datetime': $("#symbol_datetime").text(),
	    'predicted_shape': $("#predicted_shape").text(),
	    'shape_probability': parseFloat($("#shape_probability").text()),
	    'marked_shape': $("#marked_shape").text(),
	    'model_number': parseInt($("#model_number").text(),10)};
    var new_index = index-Math.round(number/2);
    
    $.ajax({
    	type: "POST",
    	url: "/save_marked",
    	data: data,
    	contentType: "application/json;charset=UTF-8",
    	data: JSON.stringify(data, null, '\t'),
    	success: function(response) {
    	    console.log(response);
    	    R = JSON.parse(response);
    	    if (R.status == 'success' || R.status == 'exists') {
                window.location.href = "/model/" + number + "/" + symbol + "?t=" + new_index;
    	    }
    	},
    	error: function(error) {
    	    console.log(error);
    	}
    });
}

function left_button(index,number,symbol){
    data = {'symbol': $("#model_symbol").text(),
	    'datetime': $("#symbol_datetime").text(),
	    'predicted_shape': $("#predicted_shape").text(),
	    'shape_probability': parseFloat($("#shape_probability").text()),
	    'marked_shape': $("#marked_shape").text(),
	    'model_number': parseInt($("#model_number").text(),10)};

    console.log(data);
    parity = number % 2
    var new_index = index-3*Math.round(number/2) + 2*parity;
    
    $.ajax({
    	type: "POST",
    	url: "/save_marked",
    	data: data,
    	contentType: "application/json;charset=UTF-8",
    	data: JSON.stringify(data, null, '\t'),
    	success: function(response) {
    	    //console.log(response);
    	    R = JSON.parse(response);
    	    if (R.status == 'success' || R.status == 'exists') {
                window.location.href = "/model/" + number + "/" + symbol + "?t=" + new_index;
    	    }
    	},
    	error: function(error) {
    	    console.log(error);
    	}
    })
}

function change_color() {
    // check to see if the current selection has been saved already
    data = {'symbol': $("#model_symbol").text(),
            'datetime': $("#symbol_datetime").text(),
            'model_number': parseInt($("#model_number").text(),10)}
    
    $.ajax({
        type: "POST",
        url: "/exists",
        data: data,
        contentType: "application/json;charset=UTF-8",
        data: JSON.stringify(data, null, '\t'),
        success: function(response) {
            R = JSON.parse(response);
            if(R.status == 'exists') {
                $('#previous-shape').removeClass('not-marked-by-user').addClass('marked-by-user');

                // change the shape
                $('#shape').text(response.shape);
            }
        }
    });
}


$(document).ready(function(){
    /* add shape to selected shape box*/
    $("a").click(function(){
        $("#marked_shape").text($(this).html());
    });
});
