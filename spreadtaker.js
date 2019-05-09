// from: https://stackoverflow.com/a/47074621
function fIsBoolean(n) {
	return !!n === n;
}

function fIsNumber(n) {
	return +n === n;
}

function fIsString(n) {
	return '' + n === n;
}


var oST = oST || {};
oST.oSettings = oST.oSettings || {};
oST.oSettings.nOrderBuyLotSize = 100;
//oST.oSettings.sOrderSymbol = 'ETHC:AQL';

// TODO make it an array or symbols and exchanges , call it
oST.oSettings.aTradedSecurities = [

	//NOTE: doing ACG:CA will route to default exchange, or perhaps most active one...?

	// sOrderSymbol is and sOrderExchange is using the VirtualBrokers as that's who we place orders through, 
		//the affix to sOrderSymbol tells VB which excahnge to route the order too, you should always route it to most busy one!!!, it does it aut for you when you sale
	// NEO Exchange
	
	//{'sOrderSymbol': 'CIM:AQL', 'sOrderExchange': 'AUTC'} 


//	{'sOrderSymbol': 'ETHC:AQL', 'sOrderExchange': 'AUTC'} 
//	,{'sOrderSymbol': 'MGW:AQL', 'sOrderExchange': 'AUTC'} 
	//,{'sOrderSymbol': 'MLC:AQL', 'sOrderExchange': 'AUTC'} 

	// 2019-05-08-1536, IMPORANT, TODO: CSE (Exchange) - NOTE WE GET QUOTES FROM NEO but that sometimes there is no DEPTH ORDER so need to code CSE IFRAME
	{'sOrderSymbol': 'ACG:CNX', 'sOrderExchange': 'AUTC'} 
];


//oST.oSettings.sOrderExchange = 'AUTC'; // used in VB
oST.oSettings.nCommissionPerShare = 0.01;
oST.oSettings.nMinimumAskToBidSpreadPercentage = 5;


oST.fCalculateCommisionsPerShare = function fCalculateCommisionsPerShare(oArgs) {
	
	let nCommission = null;
	/*
	$ 0.01 per share if share price = $1.00
  $ 0.005 per share if $0.25 = share price < $1.00
  $ 0.0025 per share if share price< $0.25
  Minimum commission is $0.01 and maximum capped to $9.99
	*/
	if (oArgs.nOrderPricePerShare >= 1.00) {
		nCommission = oArgs.nOrderBuyLotSize * 0.01;
	}
	else if (oArgs.nOrderPricePerShare >= 0.25) {
		nCommission = oArgs.nOrderBuyLotSize * 0.005;
	}
	else {
		nCommission = oArgs.nOrderBuyLotSize * 0.0025;
	}
	if (nCommission > 9.99) {
		nCommission = 9.99;
	}
	if (!fIsNumber(nCommission)) {
		console.error('=== oST.fHeartBeat(', arguments, '): ERROR: invalid `nCommission` value.');
		throw Error();
	}
	
	return (nCommission / oArgs.nOrderBuyLotSize);
}

// Set NEO IFrame to proper symbol
/*oST.fInit = function fInit() {
	if (oST.oSettings.sOrderSymbol === '') {
		console.error('=== oST.fHeartBeat(', arguments, '): ERROR: invalid `oST.oSettings.sOrderSymbol` value.');
		throw Error();
	}
	document.getElementById('oNEOIFrame').src = 'https://www.aequitasneo.com/en/single-security/' + oST.oSettings.sOrderSymbol.split(':')[0];
	oST.fHeartBeat();
}*/



/* this is executed before the iFrame loads
oNEODocument = document.getElementById('oNEOIFrame').contentDocument;
	oVBDocuemnt = document.getElementById('oVBIFrame').contentDocument;
    
*/
//oST.nSharesLedgerSum = null; // positive means we need to sell and vicevrsa
oST.oStats = oST.oStats || {};
oST.oStats.nSharesTraded = null;
oST.oStats.nProfitBeforeCommission = null;

oST.fHeartBeat = function fHeartBeat() {
    // grab the first element in our list
	let sOrderSymbol = oST.oSettings.aTradedSecurities[0].sOrderSymbol;
	let sOrderExchange = oST.oSettings.aTradedSecurities[0].sOrderSymbol;

	console.info('=== oST.fHeartBeat(', arguments, '): INFO: processing symbol `oST.oSettings.aTradedSecurities[0]=' + JSON.stringify(oST.oSettings.aTradedSecurities[0]) + '`.');

	oNEODocument = document.getElementById('oNEOIFrame').contentDocument;
	oVBDocuemnt = document.getElementById('oVBIFrame').contentDocument;
    
	// sanity check that our oNEODocument frame is for right symbol
	if (oNEODocument.body.innerText.match(sOrderSymbol.split(':')[0]) === null) {
		console.error('=== oST.fHeartBeat(', arguments, '): ERROR: symbol not found in the `oNEODocument` text.');
		throw Error();
	}
	

    let nSymbolBidHighest = oNEODocument.querySelectorAll('.brokerQuotesTable td.broker-quote-row0-bid-price')[0];
    nSymbolBidHighest = parseFloat(nSymbolBidHighest.innerText.replace(/[^0-9.]/g,''));
    if (!fIsNumber(nSymbolBidHighest) || nSymbolBidHighest <= 0) {
		console.error.apply(console, ['=== oST.fHeartBeat(', arguments, '): ERROR: invalid `nSymbolBidHighest` value.']);
		throw Error();
	}

    let nSymbolAskLowest = oNEODocument.querySelectorAll('.brokerQuotesTable td.broker-quote-row0-ask-price')[0];
    nSymbolAskLowest = parseFloat(nSymbolAskLowest.innerText.replace(/[^0-9.]/g,'')); // Number('') returns 0!!!!, we can't have that, parseFloat('') retunrs NaN
    if (!fIsNumber(nSymbolAskLowest) || (nSymbolAskLowest <= 0 && nSymbolAskLowest <= nSymbolBidHighest)) {
		console.error('=== oST.fHeartBeat(', arguments, '): ERROR: invalid `nSymbolAskLowest` value.');
		throw Error();
	}


	// get the current spread adjusted for commission, we will use that later on to see if to enter into any trades
	let nCommisionsPerShare = oST.fCalculateCommisionsPerShare({nOrderBuyLotSize: oST.oSettings.nOrderBuyLotSize, nOrderPricePerShare: nSymbolAskLowest});
	let nEffectiveSpreadPercentage = (((nSymbolAskLowest - nCommisionsPerShare) / (nSymbolBidHighest + nCommisionsPerShare)) -1) * 100;
	if (!fIsNumber(nEffectiveSpreadPercentage) || nEffectiveSpreadPercentage < oST.oSettings.nMinimumAskToBidSpreadPercentage ) {
		console.warn('=== oST.fHeartBeat(', arguments, '): WARN: no orders be placed but any existing ones will be update as spread is below required threshold, `(nEffectiveSpreadPercentage=' + nEffectiveSpreadPercentage + ') < (oST.oSettings.nMinimumAskToBidSpreadPercentage=' + oST.oSettings.nMinimumAskToBidSpreadPercentage + ')`');
	}



    //oST = {}; oVBDocuemnt = document;
    let oOrderSummayPanelIFrame = oVBDocuemnt.querySelector('iframe[src*="trading_vb_order_summary.aspx?account="]'); // we use contain becuase do specify an aboslute ULR when we initilze the frame
	
	// tally our ledger for THIS symbol
	let nSharesLedgerSum = 0;
	oOrderSummayPanelIFrame.contentWindow.$('#summary_info_list').dataTable().fnDestroy(); // remove pagination BUT THIS destroys our abilityt to click reffresh button so we will manually re-set the `src`
	let oOrdersFilledArray =  oOrderSummayPanelIFrame.contentDocument.querySelectorAll('tr.oneOrder');
	oOrdersFilledArray = Array.from(oOrdersFilledArray);
	oOrdersFilledArray = oOrdersFilledArray.filter(
		oElement => {
			return (
				oElement.querySelector('td:nth-child(11)').innerText.trim().toUpperCase().match('(FILLED)') != null
				&& oElement.querySelector('td:nth-child(2)').innerText.match(sOrderSymbol) !== null
				)
		}
	)
	oST.oStats.nSharesTraded = 0;
	oST.oStats.nProfitBeforeCommission = 0;
	for (oElement of oOrdersFilledArray) {
		let nOrderPrice = parseFloat(oElement.querySelector('td:nth-child(8)').innerText.replace(/[^0-9.]/g,'')); // Nuber('') returns 0, we want it to be NaN and parseFloat does that
		let nShares = parseFloat(oElement.querySelector('td:nth-child(4)').innerText.replace(/,/g,'').replace(/\s\/\s\d*/,''));
		if (oElement.querySelector('td:nth-child(3)').innerText.trim().toUpperCase() === 'BUY') {
			nSharesLedgerSum += nShares;
			oST.oStats.nProfitBeforeCommission += nShares * -1 * nOrderPrice;
		}
		else {
			nSharesLedgerSum -= nShares;
			oST.oStats.nProfitBeforeCommission += nShares * nOrderPrice;
		}
		oST.oStats.nSharesTraded += nShares;		
	}
	
	// Buy logic
	let oOrderBuyElement = oOrderSummayPanelIFrame.contentDocument.querySelectorAll('tr.oneOrder');
	oOrderBuyElement = Array.from(oOrderBuyElement);
	oOrderBuyElement = oOrderBuyElement.find(
		oElement => (
			oElement.querySelector('td:nth-child(3)').innerText.trim().toUpperCase() === 'BUY' 
			&& oElement.querySelector('td:nth-child(2)').innerText.match(sOrderSymbol) !== null
			&& oElement.querySelector('td:nth-child(11)').innerText.trim().toUpperCase() .match('(NEW|REPLACED)')
		)
	);
	let nOrderBuyPrice = null; 
	let sOrderBuyId = null; 
	let sOrderBuyStatus = null;
	if (oOrderBuyElement) { 
		nOrderBuyPrice = oOrderBuyElement.querySelector('td:nth-child(8)');
		nOrderBuyPrice =  parseFloat(nOrderBuyPrice.innerText.replace(/[^0-9.]/g,''));
		
		sOrderBuyId = oOrderBuyElement.querySelector('input[id*="orderID_"]').value.trim();
		
		sOrderBuyStatus = oOrderBuyElement.querySelector('td:nth-child(11)').innerText.trim().toLowerCase();
		sOrderBuyStatus = sOrderBuyStatus.charAt(0).toUpperCase() + sOrderBuyStatus.slice(1);
	} 
	// if no buy order then place one
	if (nSharesLedgerSum == 0 
		&& !oOrderBuyElement
		&& nEffectiveSpreadPercentage >= oST.oSettings.nMinimumAskToBidSpreadPercentage
		) { //IMPRV: don't use falsy values
		oTradeRquest = {
			// order_sts: Replaced | New - when modifying order, but perhaps optional?
			// order_token: 2285.190507.4 - needed when modifing an order
			trading: 'basicOrder'
			,account_id: 6303176512
			//,remain_qty: 1000
			,side: 1  // 1 - buy, 2 - sell
			,qty: nSharesLedgerSum
			,sym: sOrderSymbol
			,exch: sOrderExchange
			,ordTyp: 2 // `2` is Limit Order
			,px: nSymbolBidHighest
			,tif: 0
			,comm_est: 0 // 0 - place order, 1 - estiamte order
		}
		//debugger;
		console.info('=== oST.fHeartBeat(', arguments, '): INFO: sending a BUY limit order, `oTradeRquest=`' + JSON.stringify(oTradeRquest) + '`');
		//$.post('https://dashboard.virtualbrokers.com/UserAccount/trading_vb_resp.aspx',oTradeRquest, (oResult) => {console.log(oResult)})

	}
	// update order if Bid has changed AND is LOWER
	// 2019-may-08: NO SICNE THE STRATEGY IS ABOUT SPREAD TAKING WE NEED TO FOLLOW THE SPREAD BOTH WAYS NOT ONLY IN OUR FAVOUR
// else if (oOrderBuyElement && nOrderBuyPrice > nSymbolBidHighest) {	
	else if (oOrderBuyElement && nOrderBuyPrice !== nSymbolBidHighest) {

		oTradeRquest = {
			// order_sts: Replaced | New - when modifying order, but perhaps optional?
			order_sts: sOrderBuyStatus // this is needed!!!
			,order_token: sOrderBuyId //needed when modifing an order
			,trading: 'basicOrder'
			,account_id: 6303176512
			//,remain_qty: 1000
			,side: 1 // 1 - buy, 2 - sell
			,qty: nSharesLedgerSum
			,sym: oST.oSettings.sOrderSymbol
			,exch: sOrderExchange
			,ordTyp: 2 // `2` is Limit Order
			,px: nSymbolBidHighest
			,tif: 0
			,comm_est: 0
		}
		//debugger;
		console.info('=== oST.fHeartBeat(', arguments, '): INFO: updating an existing BUY limit order, `oTradeRquest=`' + JSON.stringify(oTradeRquest) + '`');
		//$.post('https://dashboard.virtualbrokers.com/UserAccount/trading_vb_resp.aspx',oTradeRquest, (oResult) => {console.log(oResult)})
	}
	// <<< Buy logic	


	// Sell Logic
	let oOrderSellElement = oOrderSummayPanelIFrame.contentDocument.querySelectorAll('tr.oneOrder');
	oOrderSellElement = Array.from(oOrderSellElement);
	oOrderSellElement = oOrderSellElement.find(oElement => (
		oElement.querySelector('td:nth-child(3)').innerText.trim().toUpperCase() === 'SELL' 
		&& oElement.querySelector('td:nth-child(2)').innerText.match(sOrderSymbol) !== null
		&& oElement.querySelector('td:nth-child(11)').innerText.trim().toUpperCase() .match('(NEW|REPLACED)'))
	);
	let nOrderSellPrice = null; 
	let sOrderSellId = null; 
	let sOrderSellStatus = null;
	if (oOrderSellElement) { 
		nOrderSellPrice = oOrderSellElement.querySelector('td:nth-child(8)');
		nOrderSellPrice =  parseFloat(nOrderSellPrice.innerText.replace(/[^0-9.]/g,''));
		
		sOrderSellId = oOrderSellElement.querySelector('input[id*="orderID_"]').value.trim();
		
		sOrderSellStatus = oOrderSellElement.querySelector('td:nth-child(11)').innerText.trim().toLowerCase();
		sOrderSellStatus = sOrderSellStatus.charAt(0).toUpperCase() + sOrderSellStatus.slice(1);
	} 
	// if no order then place one
	if (nSharesLedgerSum > 0 
		&& !oOrderSellElement
		&& nEffectiveSpreadPercentage >= oST.oSettings.nMinimumAskToBidSpreadPercentage
		) { //IMPRV: don't use falsy values
		oTradeRquest = {
			// order_sts: Replaced | New - when modifying order, but perhaps optional?
			// order_token: 2285.190507.4 - needed when modifing an order
			trading: 'basicOrder'
			,account_id: 6303176512
			//,remain_qty: 1000
			,side: 2 // 1 - buy, 2 - sell
			,qty: nSharesLedgerSum
			,sym: sOrderSymbol
			,exch: sOrderExchange
			,ordTyp: 2  // `2` is Limit Order
			,px: nSymbolAskLowest
			,tif: 0
			,comm_est: 0 // 0 - place order, 1 - estiamte order
		}
		//debugger;
		console.info('=== oST.fHeartBeat(', arguments, '): INFO: sending a SELL limit order, `oTradeRquest=`' + JSON.stringify(oTradeRquest) + '`');
//		$.post('https://dashboard.virtualbrokers.com/UserAccount/trading_vb_resp.aspx',oTradeRquest, (oResult) => {console.log(oResult)})
	}
//		else if (oOrderSellElement && nOrderSellPrice != nSymbolAskLowest) {
	// update our sell limit if Ask is now HIGHER then our ASK LIMIT
// 2019-may-08: NO SICNE THE STRATEGY IS ABOUT SPREAD TAKING WE NEED TO FOLLOW THE SPREAD BOTH WAYS NOT ONLY IN OUR FAVOUR
//	else if (oOrderSellElement && nOrderSellPrice < nSymbolAskLowest) {
	else if (oOrderSellElement && nOrderSellPrice !== nSymbolAskLowest) {

		oTradeRquest = {
			// order_sts: Replaced | New - when modifying order, but perhaps optional?
			order_sts: sOrderSellStatus // this is needed!!!
			,order_token: sOrderSellId //needed when modifing an order
			,trading: 'basicOrder'
			,account_id: 6303176512
			//,remain_qty: 1000
			,side: 2 // 1 - buy, 2 - sell
			,qty: nSharesLedgerSum
			,sym: sOrderSymbol
			,exch: sOrderExchange
			,ordTyp: 2  // `2` is Limit Order
			,px: nSymbolAskLowest
			,tif: 0
			,comm_est: 0
		}
		console.info('=== oST.fHeartBeat(', arguments, '): INFO: updating an existing SELL limit order, `oTradeRquest=`' + JSON.stringify(oTradeRquest) + '`');
//		$.post('https://dashboard.virtualbrokers.com/UserAccount/trading_vb_resp.aspx',oTradeRquest, (oResult) => {console.log(oResult)})
	}



	// <<< Sell logic
	
	// refresh order status window
	// our abilty to click the refresh button is lost when we destory the jquery Datatable overlay so we must use iframe reload src trick
	//let oOrderSummaryRefreshElement = oOrderSummayPanelIFrame.parentElement.previousElementSibling.querySelector('.eh_panel_refresh');
	//oOrderSummaryRefreshElement.click()
	oOrderSummayPanelIFrame.src = oOrderSummayPanelIFrame.src
	
	// updates stats
	document.querySelector('#oStatusElement').innerText += '\n' + JSON.stringify(oST.oStats, null, '\t');

	// move the symbol to end of array so that next heartbeat we tackle next item
	oST.oSettings.aTradedSecurities.push(oST.oSettings.aTradedSecurities.shift()); 

	// update our quoating iframe which will trigger heartbeat again since we have the `onload=` on it!
//	document.getElementById('oNEOIFrame').onload = setTimeout(oST.fHeartBeat, 10000); // changing src wipes our dynamic onload
	document.getElementById('oNEOIFrame').src = 'https://www.aequitasneo.com/en/single-security/' + oST.oSettings.aTradedSecurities[0].sOrderSymbol.split(':')[0];	

	// run the heartbeat again
	//setTimeout(oST.fHeartBeat, 60000);
}


// Initialize our code!
// set the URL for neo iframe if not set to the symbol, i.e. first run and start the heartbeat!
console.info('=== INFO: starting `oST.fHeartBeat()` for ` oST.oSettings.aTradedSecurities=',  oST.oSettings.aTradedSecurities, '`.');
if (document.getElementById('oNEOIFrame').src.match(oST.oSettings.aTradedSecurities[0].sOrderSymbol.split(':')[0])  === null) {
	//document.getElementById('oNEOIFrame').onload = setTimeout(oST.fHeartBeat, 10000);
	document.getElementById('oNEOIFrame').src = 'https://www.aequitasneo.com/en/single-security/' + oST.oSettings.aTradedSecurities[0].sOrderSymbol.split(':')[0];	
}