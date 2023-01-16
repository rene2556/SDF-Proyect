/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @Name LMRY_Automatic_Set_Fields_CLNT_V2.1.js
 * @Author rene@latamready.com
 * @NModuleScope public
 */
define(['N/log', 'N/record', 'N/runtime', 'N/search', './../Latam_Licenses/LMRY_Licenses_LBRY_v2.1', './../Latam_Tools/LMRY_SendEmail_LBRY_v2.1', './../Latam_Tools/LMRY_Log_LBRY_v2.1'],
    /**
     * @param{log} log
     * @param{record} record
     * @param{runtime} runtime
     * @param{search} search
     */
    function (log, record, runtime, search, Library_Licenses, Library_Mail, Library_Log) {

        /**
         * Function to be executed after page is initialized.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
         *
         * @since 2015.2
         */

        const {FeatureManager} = Library_Licenses;
        const ScriptName = "LatamReady - Automatic Set Fields CLNT v2.1";
        let actionType = "";
        let fields = {};
        let setupTax = null;
        let featureManager;
        let FEAT_SUBSIDIARY = false;

        const countryDocuments = [11, 29, 30, 91, 157, 173, 174, 186, 231];

        const transactionById = {
            5: 'cashSale',
            7: 'invoice',
            9: 'payment',
            10: 'creditMemo',
            16: 'receipt',
            17: 'vendorBill',
            20: 'vendorCredit',
            32: 'fulfillment',
            39: 'paymentComplement'
        };

        function pageInit(scriptContext) {
            try {
                actionType = scriptContext.mode;
                if (['create', 'edit', 'copy'].includes(actionType)) {
                    let recordObj = scriptContext.currentRecord;
                    FEAT_SUBSIDIARY = runtime.isFeatureInEffect({feature: 'SUBSIDIARIES'});
                    fields = getViewFields();
                    hideAndView(recordObj);
                    console.log(fields)
                    if (actionType === "create") {
                        setupTax = getSetupTax(recordObj);
                        console.log(setupTax);
                    }
                }
            }catch(err){
                console.error("[pageInit]", err);
                Library_Mail.sendEmail("[pageInit]", err, ScriptName);
                Library_Log.doLog({ title : "[pageInit]", message : err });
            }
        }

        /**
         * Validation function to be executed when field is changed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
         * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
         *
         * @returns {boolean} Return true if field is valid
         *
         * @since 2015.2
         */
        function validateField(scriptContext) {
            try {
                //Record actual
                let recordObj = scriptContext.currentRecord;
                //ID del campo
                let fieldName = scriptContext.fieldId;
                //ID de la transacción (Custpage)

                if(fieldName === 'custrecord_lmry_us_country'){
                    //que se limpie la transaction
                    recordObj.setValue({
                        fieldId: 'custrecord_lmry_us_transaction',
                        value: ''
                    });
                    hideAndView(recordObj);
                    fillTransactions(recordObj);
                }

                if (fieldName === 'custpage_transaction') {

                    //ID de la transacción
                    let transactionID = recordObj.getValue('custpage_transaction') || "";
                    console.log("transactionID", transactionID);
                    recordObj.setValue({
                        fieldId: 'custrecord_lmry_us_transaction',
                        value: transactionID
                    });
                    hideAndView(recordObj);

                }

                if (fieldName === 'custpage_subsidiary') {
                    //ID de la Subsidiaria
                    let subsidiaryID = recordObj.getValue('custpage_subsidiary') || "";
                    recordObj.setValue('custrecord_lmry_us_subsidiary', subsidiaryID);
                    setupTax = getSetupTax(recordObj);
                }

                if (fieldName === 'custrecord_lmry_us_entity') {
                    //Redireccion a configuración por entidad
                    let currentUrl = window.location.href;
                    currentUrl = currentUrl.replace("&pf=CUSTRECORD_LMRY_US_ENTITY", "");
                    currentUrl = currentUrl.replace(/&pi=\d+/, "");
                    currentUrl = currentUrl.replace("&pr=-9", "");
                    setWindowChanged(window, false);
                    window.location.href = `${currentUrl}&pf=CUSTRECORD_LMRY_US_ENTITY&pi=${entity}&pr=-9`;
                }

                if (fieldName === 'custrecord_lmry_document_type') {
                    let legalDocumentID = recordObj.getValue('custrecord_lmry_document_type');
                    let arInfoField = recordObj.getField({fieldId: 'custrecord_set_ar_info_mipymes'});

                    if (legalDocumentID != 862 && legalDocumentID != 865) {
                        recordObj.setValue('custrecord_set_ar_info_mipymes', '');
                        if (arInfoField) {
                            arInfoField.isDisabled = true;
                        }
                    } else {
                        if (arInfoField) {
                            arInfoField.isDisabled = false;
                        }
                    }

                    hideAndView(recordObj);
                }

                if (fieldName === 'custrecord_set_ar_inc_concepts') {
                    //Setear los campos LATAM - AR INITIAL SERVICE DATE y LATAM - SET END SERVICE DATE con la fecha de inicio y fin de mes
                    let ar_inc_concepts = recordObj.getValue('custrecord_set_ar_inc_concepts');
                    //Solo si el campo LATAM - AR INCLUDED CONCEPTS es Servicios o Productos y Servicios
                    if (ar_inc_concepts == 2 || ar_inc_concepts == 3) {
                        let date = new Date();
                        let primerDia = new Date(date.getFullYear(), date.getMonth(), 1);
                        let ultimoDia = new Date(date.getFullYear(), date.getMonth() + 1, 0);

                        recordObj.setValue('custrecord_set_ar_servdate_initial', primerDia);
                        recordObj.setValue('custrecord_set_ar_servdate_end', ultimoDia);
                    } else {
                        recordObj.setValue('custrecord_set_ar_servdate_initial', '');
                        recordObj.setValue('custrecord_set_ar_servdate_end', '');
                    }
                }

                if (fieldName === 'custrecord_set_service' || fieldName === 'custrecord_set_inventory' || fieldName == 'custrecord_set_bonus' || fieldName == 'custrecord_set_hibrid') {
                    let check_Service = recordObj.getValue('custrecord_set_service');
                    let check_Inventory = recordObj.getValue('custrecord_set_inventory');
                    let check_Bonus = recordObj.getValue('custrecord_set_bonus');
                    let check_Hibrid = recordObj.getValue('custrecord_set_hibrid');

                    let arrayChecks = [check_Service, check_Inventory, check_Service, check_Bonus, check_Hibrid];

                    let check_Single = arrayChecks.filter((bool) => {
                        return (bool == true)
                    }).length;

                    //Solo se puede elegir si invoice será de servicios, inventarios, bonus o hibrido, uno a la vez

                    if (check_Single > 1) {
                        alert('It can only be service or inventory or bonus or hibrid');
                        return false;
                    }

                }


            } catch (err) {
                console.error("[validateField]", err);
                Library_Mail.sendEmail("[validateField]", err, ScriptName);
                Library_Log.doLog({ title : "[validateField]", message : err });
                return false;
            }
            return true;

        }


        /**
         * Validation function to be executed when record is saved.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @returns {boolean} Return true if record is valid
         *
         * @since 2015.2
         */
        function saveRecord(scriptContext) {
            try {
                //Record Actual
                let recordObj = scriptContext.currentRecord;
                //ID del país
                let country = recordObj.getValue('custrecord_lmry_us_country');
                //ID de la subsidiaria
                let subsidiary = recordObj.getValue('custrecord_lmry_us_subsidiary');
                //ID de la subsidiaria (Setup Tax Subsidiary)
                let setupTax = recordObj.getValue('custrecord_lmry_us_setuptax');

                if (setupTax){
                    featureManager = new FeatureManager(subsidiary);
                    if (country != 157 || !featureManager.isActive(975)){
                        alert('AUTOMATIC FIELDS BY SUBSIDIARY (A/R) feature is disabled');
                        return false;
                    }
                }

                if (country == 30){
                    let check_Service = recordObj.getValue('custrecord_set_service');
                    let check_Inventory = recordObj.getValue('custrecord_set_inventory');
                    let check_Bonus = recordObj.getValue('custrecord_set_bonus');
                    let check_Hibrid = recordObj.getValue('custrecord_set_hibrid');

                    //Debe escogerse obligatoriamente si invoice será de inventario o servicio
                    if (!check_Service && !check_Inventory && !check_Bonus && !check_Hibrid){
                        alert('Must select if it is a service or inventory or bonus or hibrid');
                        return false;
                    }
                }

                if ((actionType == 'create' || actionType == 'copy') && replicatedData(recordObj)) {
                    alert('The entity already has a configuration');
                    return false;
                }
                else if (actionType == 'edit' && replicatedData(recordObj)) {
                    alert('The entity already has a configuration');
                    return false;
                }
                else {
                    return true;
                }


                
            } catch (err) {
                log.error("[saveRecord]", err);
                Library_Mail.sendEmail("[saveRecord]", err, ScriptName);
                Library_Log.doLog({ title : "[saveRecord]", message : err });
            }

        }

        const replicatedData = (recordObj) => {
            //ID de la subsidiaria
            let subsidiaryID = recordObj.getValue('custrecord_lmry_us_subsidiary');
            //ID de la entidad
            let entityID = recordObj.getValue('custrecord_lmry_us_entity');
            //ID de la transacción
            let transactionID = recordObj.getValue('custrecord_lmry_us_transaction');
            //ID del país
            let countryID = recordObj.getValue('custrecord_lmry_us_country');
            //ID del documento
            let documentID = recordObj.getValue('custrecord_lmry_document_type');
            //ID de la subsidiaria (Setup Tax Subsidiary)
            let stSubsidiaryID = recordObj.getValue('custrecord_lmry_us_setuptax');
            //Check de facturación
            let check_Fact = '';

            if (documentID) {
                let recordDocument = search.lookupFields({
                    type: 'customrecord_lmry_tipo_doc',
                    id: documentID,
                    columns: ['custrecord_lmry_fact_electronica']
                });
                check_Fact = recordDocument.custrecord_lmry_fact_electronica;
            }
            else {
                check_Fact = 'F';
            }

            //Filtros
            let filters = [];

            filters.push(search.createFilter({
                name: 'isinactive',
                operator: search.Operator.IS,
                values: ['F']
            }));

            filters.push(search.createFilter({
                name: 'custrecord_lmry_us_country',
                operator: search.Operator.ANYOF,
                values: countryID
            }));
            console.log("transation: ",transactionID);
            filters.push(search.createFilter({
                name: 'custrecord_lmry_us_transaction',
                operator: search.Operator.ANYOF,
                values: transactionID
            }));

            if (stSubsidiaryID) {
                filters.push(search.createFilter({
                    name: 'custrecord_lmry_us_entity',
                    operator: search.Operator.ANYOF,
                    values: "@NONE@"
                }));

                filters.push(search.createFilter({
                    name: 'custrecord_lmry_us_setuptax',
                    operator: search.Operator.ANYOF,
                    values: stSubsidiaryID
                }));
            }
            else {
                filters.push(search.createFilter({
                    name: 'custrecord_lmry_us_entity',
                    operator: search.Operator.ANYOF,
                    values: entityID
                }));
            }

            filters.push(search.createFilter({
                name: 'custrecord_lmry_us_subsidiary',
                operator: search.Operator.ANYOF,
                values: subsidiaryID
            }));

            if (transactionID == 5 || transactionID == 7 || transactionID == 10 || transactionID == 16 || transactionID == 17 || transactionID == 20 || transactionID == 32 || transactionID == 39) {
                filters.push(search.createFilter({
                    name: 'custrecord_lmry_fact_electronica',
                    operator: search.Operator.IS,
                    values: check_Fact,
                    join: 'custrecord_lmry_document_type'
                }));
            }

            if (actionType == 'edit') {
                filters.push(search.createFilter({
                    name: 'internalid',
                    operator: search.Operator.NONEOF,
                    values: recordObj.id
                }));
            }

            //Filtro para Brasil según los checks
            if (countryID == 30) {
                if (recordObj.getValue('custrecord_set_bonus')) {
                    filters.push(search.createFilter({
                        name: 'custrecord_set_bonus',
                        operator: search.Operator.IS,
                        values: ['T']
                    }));
                }
                else if (recordObj.getValue('custrecord_set_service')) {
                    filters.push(search.createFilter({
                        name: 'custrecord_set_service',
                        operator: search.Operator.IS,
                        values: ['T']
                    }));
                }
                else if (recordObj.getValue('custrecord_set_inventory')) {
                    filters.push(search.createFilter({
                        name: 'custrecord_set_inventory',
                        operator: search.Operator.IS,
                        values: ['T']
                    }));
                }
                else {
                    filters.push(search.createFilter({
                        name: 'custrecord_set_hibrid',
                        operator: search.Operator.IS,
                        values: ['T']
                    }));
                }
            }

            //Columnas
            let columns = [];

            columns.push(search.createColumn({
                name: 'internalid'
            }));
            let dataReplicated = search.create({
                type: 'customrecord_lmry_universal_setting_v2',
                columns: columns,
                filters: filters
            });

            dataReplicated = dataReplicated.run().getRange(0, 10);
            if (dataReplicated && dataReplicated.length) {
                return true;
            } else {
                return false;
            }
        }

        const getSetupTax = (recordObj) => {
            let entity = recordObj.getValue({fieldId: "custrecord_lmry_us_entity"});
            let subsidiary = recordObj.getValue({fieldId: "custpage_subsidiary"});
            let setupTax = recordObj.getValue({fieldId: "custrecord_lmry_us_setuptax"});
            //Filtros
            if ((entity && subsidiary) || setupTax) {
                let filters = [
                    ["isinactive", "is", "F"]
                ];

                if (entity) {
                    if (FEAT_SUBSIDIARY) {
                        filters.push("AND", ["custrecord_lmry_setuptax_subsidiary", "anyof", subsidiary]);
                    }
                }else if(setupTax){
                    filters.push("AND",["internalid","anyof", setupTax]);
                }

                //Búsqueda Setup Tax Subsidiary
                let setupTaxSearch = search.create({
                    type: "customrecord_lmry_setup_tax_subsidiary",
                    filters: filters,
                    columns: ["custrecord_lmry_setuptax_ar_doc_type_val"]
                })

                let result = setupTaxSearch.run().getRange(0, 1)
                if (result && result.length) {
                    return {
                        "arDocumentType": result[0].getValue("custrecord_lmry_setuptax_ar_doc_type_val") || ""
                    }
                }
            }

            return null;
        }

        const getViewFields = () => {
            let fields = {"none": []};

            let viewSearch = search.create({
                type: "customrecord_lmry_setup_universal_set_v2",
                filters:
                    [
                        ["isinactive", "is", "F"]
                    ],
                columns:
                    [
                        "name",
                        "custrecord_lmry_setup_us_record_key",
                        "custrecord_lmry_setup_us_country",
                        "custrecord_lmry_setup_us_vendorbill",
                        "custrecord_lmry_setup_us_vendorcredit",
                        "custrecord_lmry_setup_us_cashsale",
                        "custrecord_lmry_setup_us_credit",
                        "custrecord_lmry_setup_us_inv_exp",
                        "custrecord_lmry_setup_us_invoice",
                        "custrecord_lmry_setup_us_fulfillment",
                        "custrecord_lmry_setup_us_credit_exp",
                        "custrecord_lmry_setup_us_lib_consig",
                        "custrecord_lmry_setup_us_nota_deb",
                        "custrecord_lmry_setup_us_notadeb_exp",
                        "custrecord_lmry_setup_us_payment",
                        "custrecord_lmry_setup_us_paymntcomplemnt",
                        "custrecord_lmry_setup_us_recepit"
                    ]
            });

            let results = viewSearch.run().getRange(0, 1000);
            for (let i = 0; i < results.length; i++) {
                let name = results[i].getValue("name") || "";
                name = name.trim();

                let country = results[i].getValue("custrecord_lmry_setup_us_country") || "";
                let isRecordKey = results[i].getValue("custrecord_lmry_setup_us_record_key") || false;
                isRecordKey = (isRecordKey === "T" || isRecordKey === true);
                if (!country) {
                    fields["none"].push(name);
                } else {
                    let types = [];
                    let transactions = {
                        vendorBill: results[i].getValue("custrecord_lmry_setup_us_vendorbill") || false,
                        vendorCredit: results[i].getValue("custrecord_lmry_setup_us_vendorcredit") || false,
                        cashSale: results[i].getValue("custrecord_lmry_setup_us_cashsale") || false,
                        creditMemo: results[i].getValue("custrecord_lmry_setup_us_credit") || false,
                        exportacion: results[i].getValue("custrecord_lmry_setup_us_inv_exp") || false,
                        invoice: results[i].getValue("custrecord_lmry_setup_us_invoice") || false,
                        fulfillment: results[i].getValue("custrecord_lmry_setup_us_fulfillment") || false,
                        creditExportacion: results[i].getValue("custrecord_lmry_setup_us_credit_exp") || false,
                        libreConsigna: results[i].getValue("custrecord_lmry_setup_us_lib_consig") || false,
                        notaDebito: results[i].getValue("custrecord_lmry_setup_us_nota_deb") || false,
                        notaDebitoExportacion: results[i].getValue("custrecord_lmry_setup_us_notadeb_exp") || false,
                        payment: results[i].getValue("custrecord_lmry_setup_us_payment") || false,
                        paymentComplement: results[i].getValue("custrecord_lmry_setup_us_paymntcomplemnt") || false,
                        receipt: results[i].getValue("custrecord_lmry_setup_us_recepit") || false
                    };

                    for (let trKey in transactions) {
                        if (transactions[trKey] === "T" || transactions[trKey]) {
                            types.push(trKey);
                        }
                    }

                    if (!fields.hasOwnProperty(country)) {
                        fields[country] = [];
                    }

                    fields[country].push({name: name, types: types, isRecordKey : isRecordKey});
                }
            }

            return fields;
        }

        const hideAndView = (recordObj) => {
            //ocultar
            let hideFields = fields["none"];
            console.log("fields", fields);

            hideFields.forEach((fieldName) => {
                let fieldObj = recordObj.getField(fieldName);
                if (fieldObj) {
                    fieldObj.isDisplay = false;
                }
            });

            let country = recordObj.getValue('custrecord_lmry_us_country') || "";
            console.log("Country", country);
            country = Number(country);
            let transaction = recordObj.getValue('custrecord_lmry_us_transaction') || "";
            transaction = Number(transaction);
            if (country && transaction) {
                let isNotaDebito = false, isExportacion = false, isLibreConsigna = false;
                //Invoice, CreditMemo
                let document = recordObj.getValue('custrecord_lmry_document_type');

                if ([7, 10].includes(transaction) && countryDocuments.includes(country) && document) {
                    let recordDocument = search.lookupFields({
                        type: 'customrecord_lmry_tipo_doc',
                        id: document,
                        columns: ['custrecord_lmry_es_nota_de_debito', 'custrecord_lmry_es_exportacion', 'custrecord_lmry_es_libre_consigna']
                    });
                    isNotaDebito = recordDocument.custrecord_lmry_es_nota_de_debito;
                    isExportacion = recordDocument.custrecord_lmry_es_exportacion;
                    isLibreConsigna = recordDocument.custrecord_lmry_es_libre_consigna;
                }

                let viewFields = [];
                if (fields.hasOwnProperty(country)) {
                    if (transaction == 7) {
                        if (isExportacion && isNotaDebito) {
                            viewFields = fields[country].filter((f) => {
                                return f.types.includes("notaDebitoExportacion");
                            });
                        } else if (isNotaDebito) {
                            viewFields = fields[country].filter((f) => {
                                return f.types.includes("notaDebito");
                            });
                        } else if (isExportacion) {
                            viewFields = fields[country].filter((f) => {
                                return f.types.includes("exportacion");
                            });
                        } else if (isLibreConsigna) {
                            viewFields = fields[country].filter((f) => {
                                return f.types.includes("libreConsigna");
                            });
                        } else if (!isExportacion && !isNotaDebito && !isLibreConsigna) {
                            viewFields = fields[country].filter((f) => {
                                return f.types.includes(transactionById[transaction]);
                            });
                        }
                    } else if (transaction == 10 && isExportacion) {
                        viewFields = fields[country].filter((f) => {
                            return f.types.includes("creditExportacion");
                        });
                    } else {
                        viewFields = fields[country].filter((f) => {
                            return f.types.includes(transactionById[transaction]);
                        });
                    }
                }

                viewFields.forEach((obj) => {
                    let fieldObj = recordObj.getField(obj.name);
                    if (fieldObj && !obj.isRecordKey && !validateARfields(recordObj, obj.name)) {
                        fieldObj.isDisplay = true;
                    }
                });
            }

        }

        const validateARfields = (recordObj, fieldName) => {
            let document = recordObj.getValue("custrecord_lmry_document_type");
            let country = recordObj.getValue("custrecord_lmry_us_country");
            let transaction = recordObj.getValue('custrecord_lmry_us_transaction') || "";
            return (country == 11 && transaction == 7 && ['custrecord_lmry_document_type_validate', 'custrecord_lmry_serie_doc_cxc_validate'].includes(fieldName) && setupTax && setupTax.arDocumentType == document);
        }

        const fillTransactions = (recordObj) => {
            let entityTypeID = recordObj.getValue('custrecord_lmry_us_entity_type');
            let countryID = recordObj.getValue('custrecord_lmry_us_country');
            let transactionField = recordObj.getField({fieldId: 'custpage_transaction'});
            console.log("entityTypeID", entityTypeID);
            console.log("countryID", countryID);
            console.log("transactionField", transactionField);

            //Objeto de transacciones por país y tipo de entidad
            const jsonTransactionByCountry = {
                "11": {
                    "1": [],
                    "2": ["invoice", "creditmemo"]
                },
                "29": {
                    "1": [],
                    "2": ["invoice", "creditmemo"]
                },
                "30": {
                    "1": ["vendorbill", "vendorcredit", "itemreceipt"],
                    "2": ["invoice", "creditmemo", "itemfulfillment"]
                },
                "45": {
                    "1": [],
                    "2": ["invoice", "creditmemo"] //7, 10
                },
                "48": {
                    "1": [],
                    "2": ["invoice", "creditmemo"]
                },
                "49": {
                    "1": [],
                    "2": ["invoice", "creditmemo"]
                },
                "63": {
                    "1": [],
                    "2": ["invoice", "creditmemo"]
                },
                "91": {
                    "1": [],
                    "2": ["invoice", "creditmemo"]
                },
                "157": {
                    "1": [],
                    "2": ["invoice", "creditmemo", "itemfulfillment", "customerpayment", "customtransaction_lmry_payment_complemnt"]
                },
                "173": {
                    "1": [],
                    "2": ["invoice", "creditmemo"]
                },
                "174": {
                    "1": [],
                    "2": ["invoice", "creditmemo", "itemfulfillment", "cashsale"]
                },
                "186": {
                    "1": [],
                    "2": ["invoice", "creditmemo"]
                },
                "231": {
                    "1": [],
                    "2": ["invoice", "creditmemo"]
                }
            };

            const transactionsById = {
                "invoice": {name: "Invoice", id: 7},
                "creditmemo": {name: "Credit Memo", id: 10},
                "vendorbill": {name: "Bill", id: 17},
                "vendorcredit": {name: "Bill Credit", id: 20},
                "itemfulfillment": {name: "Item Fulfillment", id: 32},
                "customerpayment": {name: "Payment", id: 9},
                "customtransaction_lmry_payment_complemnt": {name: "Complemento de Pago", id: 39},
                "cashsale": {name: "Cash Sale", id: 5},
                "itemreceipt": {name: "Item Receipt", id: 16}
            };

            let transactions = [];
            if (countryID){
                if (entityTypeID && (entityTypeID == "1" || entityTypeID == "2") && countryID){
                    transactions = jsonTransactionByCountry[countryID][entityTypeID];
                } else {
                    transactions = [...jsonTransactionByCountry[countryID]['1'],...jsonTransactionByCountry[countryID]['2']];
                }

                transactionField.removeSelectOption({ value : null});
                transactionField.insertSelectOption({ value : '', text : "&nbsp" });
                for(let i = 0; i < transactions.length ; i++){
                    let {name, id} = transactionsById[transactions[i]];
                    transactionField.insertSelectOption({ value : id, text : name });
                }
            } else {
                transactionField.removeSelectOption({ value : null});
            }

        }


        return {
            pageInit: pageInit,
            validateField: validateField,
            saveRecord: saveRecord
        };

    });
