var iconv = require('iconv-lite');
var fs = require('fs');
var dbf = require('dbf');

function DBFReader() {
	this.from = fs.openSync('./bb.dbf', 'r');
	this.to = fs.openSync('./cc.dbf', 'w');
	this.headerLength = 0;
	this.numberOfRecord = 0;
	this.numberOfRecordByte = 0;
	this.titles = [];
	this.fieldType = [];
	this.fieldLength = [];
}

DBFReader.prototype.readHeader = function() {
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

DBFReader.prototype.readRecords = function() {
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

DBFReader.prototype.parse = function() {
	this.readHeader();
	return this.readRecords();
};

(function() {
	var converter = new DBFReader();
	console.log(converter.parse());
})();


