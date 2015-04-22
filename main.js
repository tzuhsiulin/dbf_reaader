var iconv = require('iconv-lite');
var fs = require('fs');
var dbf = require('dbf');

function DBFEncodingConverter() {
	this.from = fs.openSync('./bb.dbf', 'r');
	this.to = fs.openSync('./cc.dbf', 'w');
	this.headerLength = 0;
	this.numberOfRecord = 0;
	this.numberOfRecordByte = 0;
	this.titles = [];
	this.fieldType = [];
	this.fieldLength = [];
}

DBFEncodingConverter.prototype.readHeader = function() {
	var buf;

	// read header length
	buf = new Buffer(2);
	buf.fill(0);
	fs.readSync(this.from, buf, 0, 2, 8);
	this.headerLength = buf.readUInt16LE(0);

	// read all of header
	buf = new Buffer(this.headerLength);
	fs.readSync(this.from, buf, 0, this.headerLength);

	// get number of record
	this.numberOfRecord = buf.readUInt32LE(4, 3);

	// get bytes of record
	this.numberOfRecordByte = buf.readUInt16LE(10, 2);

	// read titles
	for (var i = 32; i+32 < this.headerLength; i+=32) {
		this.titles.push(buf.toString('ascii', i, i+10).replace(/\u0000/g, '').trim());
		this.fieldType.push(buf.toString('ascii', i+11, i+11+1));
		this.fieldLength.push(parseInt(buf[i+16], 10));
	}
};

DBFEncodingConverter.prototype.readRecords = function() {
	var buf;
	var startPosition = this.headerLength + 1;
	var records = [];

	for (var i = startPosition, j = 0; j < this.numberOfRecord; i+=this.numberOfRecordByte, j++) {
		// init array of item
		var record = {};

		for (var k = 0, l = i; k < this.titles.length; k++) {
			if (!this.titles[k].length) {
				break;
			}

			// init buffer
			buf = new Buffer(this.fieldLength[k]);
			buf.fill(0);

			// read length of buffer
			fs.readSync(this.from, buf, 0, buf.length, l);

			// convert content
			switch (this.fieldType[k]) {
				case 'C':
					var str = iconv.decode(buf, 'Big5');
					record[this.titles[k]] = str.trim();

					// record[this.titles[k]] = buf.toString().trim();
					break;
				case 'N':
				case 'I':
					var str = buf.toString().trim();
					var val = str == '' ? 0 : parseInt(str, 10);
					record[this.titles[k]] = val;
					break;
				case 'F':
				case 'B':
					var str = buf.toString().trim();
					var val = str == '' ? 0 : parseFloat(str);
					record[this.titles[k]] = val;
					break;
				case 'D':
					record[this.titles[k]] = buf.toString().trim();
					break;
			}

			// seek position
			startPosition += buf.length;
			l += this.fieldLength[k];
		}

		// push item into records
		records.push(record);
	}

	return records;
};

DBFEncodingConverter.prototype.parse = function() {
	this.readHeader();
	var records = this.readRecords();

	if (records && records.length > 0) {
		this.writeHeader(records);
		this.writeBody(records);
	}
};

DBFEncodingConverter.prototype.writeHeader = function(records) {
	var buf = new Buffer(this.headerLength);

	fs.readSync(this.from, buf, 0, this.headerLength, 0);
	fs.writeSync(this.to, buf, 0, buf.length, 0);
};

DBFEncodingConverter.prototype.writeBody = function(records) {
	var buf, position, j;
	var start = this.headerLength+1;

	for (var i = 0; i < records.length; i++) {
		var buf = new Buffer(this.numberOfRecordByte);
		buf.fill(0x20);

		position = j = 0;
		for (var key in records[i]) {
			if (typeof records[i][key] == 'number') {
				var str = records[i][key].toString();
				for (var l = 0; l < str.length; l++) {
					buf.write(str[l], position+l, 1);
				}
			}
			else if (typeof records[i][key] == 'string') {
				var strbuf = new Buffer(records[i][key]);
				buf.write(records[i][key], position, strbuf.length);
			}

			position += this.fieldLength[j];
			j++;
		}

		fs.writeSync(this.to, buf, 0, buf.length, start+(i*this.numberOfRecordByte));
	}
};

(function() {
	var converter = new DBFEncodingConverter();
	converter.parse();
	// console.log(records);
})();


