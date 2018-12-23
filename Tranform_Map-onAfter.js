(function runTransformScript(source, map, log, target /*undefined onStart*/ ) {
	
	var SSBcheckinError = false;
	var SSBcheckinErrormsg = '';
	
	//Glide Lookup of Tech info
	var techGR = new GlideRecord('x_ihgih_ssb_api_authorized_techs');
	techGR.addQuery('u_techid',source.u_tech);
	techGR.query();
	if(techGR.next()){
		techID = techGR.u_tech_name.user_name;
		gs.debug('techID= '+techID);
		techSYS = techGR.u_tech_name;
		gs.debug('techSYS= '+techSYS);
	} else{
		SSBcheckinError = true;
		SSBcheckinErrormsg = 'Failed Tech Lookup';
		return;
	}
	
	//Glide Lookup of user info
	var userGR = new GlideRecord('sys_user');
	userGR.addQuery('u_correlation_id',source.u_assignment);
	userGR.query();
	if(userGR.next()){
		userSYS = userGR.sys_id;
		gs.debug('userSYS= '+userSYS);
	}else{
		userSYS = '';
	}
	
	var req_submit = '';
	
	if (source.u_action == 'Check In'){
		if(source.u_assignment == 'NEW HARDWARE' || source.u_assignment == 'IMAGED' || source.u_assignment == 'TRIAGE'){
			req_submit = true;
		} else{
			SSBcheckinError = true;
			SSBcheckinErrormsg = 'Invalid Action/Assignment Combination';
			return;
		}
	} else if (source.u_action == 'Check Out'){
		if(source.u_assignment == 'NEW HARDWARE' || source.u_assignment == 'DISPOSAL' || source.u_assignment == 'RMA'){
			req_submit = true;
		} else if (userSYS != ''){
			req_submit = true;
		} else{
			SSBcheckinError = true;
			SBcheckinErrormsg = 'Invalid Action/Assignment Combination OR User Lookup Failed';
			return;
		}
	} else if (source.u_action == 'Preparing for User'){
		req_submit=true;
	} else if (source.u_action == 'Shipping to User'){
		req_submit = true;
	} else if (source.u_action == 'Ready for Pickup'){
		req_submit = true;
	}else{
		SSBcheckinError = true;
		SSBcheckinErrormsg = 'Invalid Action/Assignment Combination';
		return;
	}
	
	if(req_submit == true){
		//Impersonate Tech - Imperative for Proper Audit reporting
		gs.include('global.Impersonator');
		var impersonator =  new global.Impersonator().impersonateUser(techSYS);
		gs.debug('I am impersonating '+impersonator);
		//create RITM
		var cart = new sn_sc.CartJS();
		var item =
		{
			'sysparm_id': '27e0e16ddb505b0029c804c2ca96199b',
			'sysparm_quantity': '1',
			'variables': {
				'req_tech_ref': ""+techSYS+"",
				'u_requested_by': ""+techSYS+"",
				'req_machine_ref': ""+target.sys_id+"",
				'req_action': ""+source.u_action+"",
				'req_assignment_string': ""+source.u_assignment+"",
				'req_assignment_ref': ""+userSYS+"",
				'u_requested_for': ""+userSYS+"",
				'req_imp_set': ""+imp_set+"",
				'req_stockroom': ""+source.u_stockroom+""
			}};
			var cartDetails = cart.addToCart(item);
			gs.info('Cart details: '+JSON.stringify(cartDetails)+' Machine= '+target.sys_id);
			gs.info('Cart sysID: '+cartDetails.sys_id);
			var checkoutInfo = cart.checkoutCart();
			gs.info('Checkout Info: '+checkoutInfo);
			gs.info('Checkout Completed');
		}
		
	})(source, map, log, target);