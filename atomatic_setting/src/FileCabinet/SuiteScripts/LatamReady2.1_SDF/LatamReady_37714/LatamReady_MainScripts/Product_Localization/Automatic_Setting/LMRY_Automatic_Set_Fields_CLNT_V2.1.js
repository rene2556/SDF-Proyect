/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @Name LMRY_Automatic_Set_Fields_CLNT_V2.1.js
 * @Author rene@latamready.com
 * @NModuleScope public
 */
define(['N/log', 'N/record', 'N/runtime', 'N/search'],
    /**
     * @param{log} log
     * @param{record} record
     * @param{runtime} runtime
     * @param{search} search
     */
    function (log, record, runtime, search) {

        /**
         * Function to be executed after page is initialized.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
         *
         * @since 2015.2
         */

        let actionType = "";
        let viewFields = {};
        let setupTax = null;
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
            39: 'paymentcomplement'
        };

        function pageInit(scriptContext) {
            actionType = scriptContext.mode;
            let recordObj = scriptContext.currentRecord;
            FEAT_SUBSIDIARY = runtime.isFeatureInEffect({feature: 'SUBSIDIARIES'});
            viewFields = getViewFields();
            console.log(viewFields)
            if (actionType === "create") {
                setupTax = getSetupTax(recordObj);
                console.log(setupTax);
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

                if (fieldName === 'custpage_transaction') {

                    //ID de la transacción
                    let transactionID = recordObj.getValue('custpage_transaction') || "";
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
                    hideAndView(recordObj);

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

                    let arrayChecks = [check_Service, check_Service, check_Bonus, check_Hibrid];

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
                return false;
            }
            return true;

        }

        /**
         * Validation function to be executed when sublist line is committed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @returns {boolean} Return true if sublist line is valid
         *
         * @since 2015.2
         */
        function validateLine(scriptContext) {

        }

        /**
         * Validation function to be executed when sublist line is inserted.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @returns {boolean} Return true if sublist line is valid
         *
         * @since 2015.2
         */
        function validateInsert(scriptContext) {

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

        const getViewFields = (recordObj) => {
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

                if (!country) {

                } else {
                    let types = [];
                    let transactions = {
                        vendorBill: results[i].getValue("custrecord_lmry_setup_us_vendorbill") || false,
                        vendoCredit: results[i].getValue("custrecord_lmry_setup_us_vendorcredit") || false,
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

                    fields[country].push({name: name, types: types});
                }
            }

            return fields;
        }

        const hideAndView = (recordObj) => {
            //ocultar
            let hideFields = fields["none"];

            hideFields.forEach((fieldName) => {
                let fieldObj = recordObj.getFields(fieldName);
                if (fieldObj) {
                    fieldObj.isDisplay = false;
                }
            });

            let country = recordObj.getValue('custrecord_lmry_us_country') || "";
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

                let viewField = [];
                if (fields.hasOwnProperty(country)) {
                    if (transaction == 7) {
                        if (isExportacion && isNotaDebito) {
                            viewField = fields[country].filter((f) => {
                                return f.type.includes("notaDebitoExportacion");
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

                viewFields.forEach((fieldName) => {
                    let fieldObj = recordObj.getField(fieldName);
                    if (fieldObj) {
                        fieldObj.isDisplay = true;
                    }
                });
            }

        }


        return {
            pageInit: pageInit,
            validateField: validateField,
            saveRecord: saveRecord
        };

    });
